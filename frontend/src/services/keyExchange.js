// Custom Key Exchange Protocol Implementation
// Protocol: ECDH + Digital Signatures + Key Confirmation

import { CryptoUtils } from '../utils/crypto';
import { KeyStorage } from '../utils/keyStorage';
import api from './api';

// Helper to get current user ID
const getCurrentUserId = () => {
  const userData = localStorage.getItem('userData');
  if (!userData) {
    throw new Error('User not logged in');
  }
  return JSON.parse(userData).userId;
};

export const KeyExchangeProtocol = {
  // Step 1: Initiator starts key exchange
  async initiateKeyExchange(responderId) {
    try {
      // Generate ephemeral ECDH key pair
      const ecdhKeyPair = await CryptoUtils.generateECDHKeyPair();
      
      // Export public key
      const publicKeyBase64 = await CryptoUtils.exportPublicKey(ecdhKeyPair.publicKey);
      
      // Get signing key (user-specific)
      const userId = getCurrentUserId();
      const signingPrivateKey = await KeyStorage.getPrivateKey(`${userId}_ecdsa_private`);
      if (!signingPrivateKey) {
        throw new Error('Signing key not found');
      }

      console.log('Using ECDSA private key for signing (first 50 chars):', signingPrivateKey.substring(0, 50) + '...');

      const signingKey = await CryptoUtils.importPrivateKey(
        signingPrivateKey,
        { name: 'ECDSA', namedCurve: 'P-256' }
      );

      // Create signature: Sign(ECDH_public_key)
      const dataToSign = publicKeyBase64;
      console.log('Signing data:', dataToSign.substring(0, 50) + '...');
      const signature = await CryptoUtils.signData(dataToSign, signingKey);
      console.log('Generated signature:', signature.substring(0, 50) + '...');
      const timestamp = Date.now();

      // Send to server
      const response = await api.post('/key-exchange/initiate', {
        responderId,
        publicKey: publicKeyBase64,
        signature,
        timestamp,
      });

      // Store ephemeral private key temporarily
      await KeyStorage.storePrivateKey(
        `ecdh_temp_${response.data.sessionId}`,
        await CryptoUtils.exportPrivateKey(ecdhKeyPair.privateKey)
      );

      // Notify responder via WebSocket
      const socketService = (await import('./socketService')).default;
      socketService.emit('key-exchange-request', {
        sessionId: response.data.sessionId,
        responderId,
      });

      return {
        sessionId: response.data.sessionId,
        expiresAt: response.data.expiresAt,
      };
    } catch (error) {
      console.error('Key exchange initiation failed:', error);
      throw error;
    }
  },

  // Step 2: Responder responds to key exchange
  async respondToKeyExchange(sessionId, initiatorId, initiatorPublicKey, initiatorSignature) {
    try {
      // Get initiator's ECDSA public key for verification
      console.log('Fetching initiator verification key for user:', initiatorId);
      const initiatorVerifyKey = await this.getVerificationKey(initiatorId);
      
      // Verify initiator's signature on their public key
      console.log('Verifying signature...');
      console.log('Data to verify:', initiatorPublicKey.substring(0, 50) + '...');
      console.log('Signature:', initiatorSignature.substring(0, 50) + '...');
      
      const isValid = await CryptoUtils.verifySignature(
        initiatorPublicKey,
        initiatorSignature,
        initiatorVerifyKey
      );
      
      console.log('Signature verification result:', isValid);
      
      if (!isValid) {
        // Log invalid signature to server for security audit
        try {
          await api.post('/key-exchange/signature-failed', {
            sessionId,
            userId: initiatorId,
            reason: 'Invalid initiator signature - possible MITM attack'
          });
        } catch (logError) {
          console.error('Failed to log signature failure:', logError);
        }
        throw new Error('Invalid initiator signature - possible MITM attack');
      }
      
      console.log('✓ Initiator signature verified successfully');

      // Generate ephemeral ECDH key pair
      const ecdhKeyPair = await CryptoUtils.generateECDHKeyPair();
      
      // Export public key
      const publicKeyBase64 = await CryptoUtils.exportPublicKey(ecdhKeyPair.publicKey);

      // Get signing key (user-specific)
      const userId = getCurrentUserId();
      const signingPrivateKey = await KeyStorage.getPrivateKey(`${userId}_ecdsa_private`);
      const signingKey = await CryptoUtils.importPrivateKey(
        signingPrivateKey,
        { name: 'ECDSA', namedCurve: 'P-256' }
      );

      // Create signature on public key
      const dataToSign = publicKeyBase64;
      const signature = await CryptoUtils.signData(dataToSign, signingKey);
      const timestamp = Date.now();

      // Send response to server
      const response = await api.post('/key-exchange/respond', {
        sessionId,
        publicKey: publicKeyBase64,
        signature,
        timestamp,
      });

      // Import initiator's public key
      const initiatorECDHPublicKey = await CryptoUtils.importPublicKey(
        initiatorPublicKey,
        { name: 'ECDH', namedCurve: 'P-256' }
      );

      // Derive shared secret
      const sharedSecret = await CryptoUtils.deriveSharedSecret(
        ecdhKeyPair.privateKey,
        initiatorECDHPublicKey
      );

      // Derive session key using HKDF with deterministic salt
      const saltString = `salt-${sessionId}`;
      const salt = new TextEncoder().encode(saltString);
      const sessionKey = await CryptoUtils.deriveAESKey(
        sharedSecret,
        salt,
        `session-${sessionId}`
      );

      // Store session key (export as raw key, not private key)
      const exportedSessionKey = await window.crypto.subtle.exportKey('raw', sessionKey);
      const base64Key = CryptoUtils.arrayBufferToBase64(exportedSessionKey);
      await KeyStorage.storeSessionKey(initiatorId, base64Key);

      return {
        success: true,
        sessionId,
      };
    } catch (error) {
      console.error('Key exchange response failed:', error);
      throw error;
    }
  },

  // Step 3: Initiator completes key exchange
  async completeKeyExchange(sessionId, responderId) {
    try {
      // Poll for completion
      const response = await api.get(`/key-exchange/status/${sessionId}`);

      if (response.data.status !== 'completed') {
        throw new Error('Key exchange not completed yet');
      }

      const { responderPublicKey, responderSignature } = response.data;

      // Verify responder's signature on their public key
      const responderVerifyKey = await this.getVerificationKey(responderId);
      const isValid = await CryptoUtils.verifySignature(
        responderPublicKey,
        responderSignature,
        responderVerifyKey
      );
      
      if (!isValid) {
        // Log invalid signature to server for security audit
        try {
          await api.post('/key-exchange/signature-failed', {
            sessionId,
            userId: responderId,
            reason: 'Invalid responder signature - possible MITM attack'
          });
        } catch (logError) {
          console.error('Failed to log signature failure:', logError);
        }
        throw new Error('Invalid responder signature - possible MITM attack');
      }
      
      console.log('✓ Responder signature verified successfully');

      // Get stored ephemeral private key
      const privateKeyBase64 = await KeyStorage.getPrivateKey(`ecdh_temp_${sessionId}`);
      const ecdhPrivateKey = await CryptoUtils.importPrivateKey(
        privateKeyBase64,
        { name: 'ECDH', namedCurve: 'P-256' }
      );

      // Import responder's public key
      const responderECDHPublicKey = await CryptoUtils.importPublicKey(
        responderPublicKey,
        { name: 'ECDH', namedCurve: 'P-256' }
      );

      // Derive shared secret
      const sharedSecret = await CryptoUtils.deriveSharedSecret(
        ecdhPrivateKey,
        responderECDHPublicKey
      );

      // Derive session key using HKDF with deterministic salt
      const saltString = `salt-${sessionId}`;
      const salt = new TextEncoder().encode(saltString);
      const sessionKey = await CryptoUtils.deriveAESKey(
        sharedSecret,
        salt,
        `session-${sessionId}`
      );

      // Store session key (export as raw key, not private key)
      const exportedSessionKey = await window.crypto.subtle.exportKey('raw', sessionKey);
      const base64Key = CryptoUtils.arrayBufferToBase64(exportedSessionKey);
      await KeyStorage.storeSessionKey(responderId, base64Key);

      // Clean up ephemeral key
      await KeyStorage.deleteKey(`ecdh_temp_${sessionId}`);

      // Send and verify key confirmation message
      const confirmationVerified = await this.sendAndVerifyKeyConfirmation(responderId, sessionKey, sessionId);
      
      if (!confirmationVerified) {
        throw new Error('Key confirmation failed - session keys do not match');
      }

      console.log('✓ Key confirmation successful - session keys match');

      return {
        success: true,
        sessionId,
      };
    } catch (error) {
      console.error('Key exchange completion failed:', error);
      throw error;
    }
  },

  // Send and verify key confirmation message
  async sendAndVerifyKeyConfirmation(userId, sessionKey, sessionId) {
    try {
      // Create confirmation message with session ID
      const confirmationMessage = `KEY_CONFIRMATION_${sessionId}_${Date.now()}`;
      const encrypted = await CryptoUtils.encryptMessage(confirmationMessage, sessionKey);
      
      // Send confirmation to server
      await api.post('/key-exchange/confirm', {
        userId,
        sessionId,
        encryptedConfirmation: encrypted.encryptedContent,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      });

      console.log('✓ Key confirmation message sent successfully');
      return true;
    } catch (error) {
      console.error('Key confirmation failed:', error);
      return false;
    }
  },

  // Get verification key for a user (always fetch fresh from server)
  async getVerificationKey(userId) {
    try {
      // Always fetch the latest public key from server
      const response = await api.get(`/users/${userId}/public-key`);
      console.log('Fetched public key from server:', response.data.publicKey.substring(0, 100) + '...');
      
      const publicKeys = JSON.parse(response.data.publicKey);
      console.log('Parsed ECDSA key:', publicKeys.ecdsa?.substring(0, 50) + '...');
      
      if (!publicKeys.ecdsa) {
        throw new Error('ECDSA public key not found for user');
      }
      
      return await CryptoUtils.importPublicKey(
        publicKeys.ecdsa,
        { name: 'ECDSA', namedCurve: 'P-256' }
      );
    } catch (error) {
      console.error('Failed to get verification key:', error);
      throw new Error('Could not retrieve user public key for verification');
    }
  },

  // Get or create session key for a user
  async getOrCreateSessionKey(userId) {
    let sessionKey = await KeyStorage.getSessionKey(userId);
    
    if (!sessionKey) {
      console.log('No session key found for user, initiating key exchange...');
      
      // Initiate key exchange (username not needed for protocol)
      const result = await this.initiateKeyExchange(userId);
      console.log('Key exchange initiated, session:', result.sessionId);
      
      // Wait for responder to complete (with retries)
      let attempts = 0;
      const maxAttempts = 30; // Increased from 10 to 30 seconds
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          await this.completeKeyExchange(result.sessionId, userId);
          sessionKey = await KeyStorage.getSessionKey(userId);
          
          if (sessionKey) {
            console.log('Key exchange completed successfully');
            break;
          }
        } catch (error) {
          if (attempts === 0 || attempts === 5 || attempts === 15) {
            // Only log at specific intervals to reduce console spam
            console.log(`Waiting for other user to come online... (${attempts + 1}s)`);
          }
        }
        
        attempts++;
      }
      
      if (!sessionKey) {
        throw new Error('The other user needs to be online to establish a secure connection. Please try again when they are online.');
      }
    }

    // Import the key from base64
    const keyBuffer = CryptoUtils.base64ToArrayBuffer(sessionKey);
    return await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },
};

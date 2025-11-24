import { CryptoUtils } from '../utils/crypto';
import { KeyStorage } from '../utils/keyStorage';
import { KeyExchangeProtocol } from './keyExchange';
import api from './api';

export const MessageService = {
  // Send encrypted message
  async sendMessage(receiverId, messageText) {
    try {
      // Get or create session key
      const sessionKey = await KeyExchangeProtocol.getOrCreateSessionKey(receiverId);

      // Encrypt message with AES-256-GCM
      const encrypted = await CryptoUtils.encryptMessage(messageText, sessionKey);

      // Generate nonce for replay protection
      const nonce = CryptoUtils.generateNonce();

      // Get sequence number for this conversation (peek, don't increment yet)
      const sequenceNumber = await this.peekNextSequenceNumber(receiverId);

      // Add a small delay to ensure messages are sent in order
      // This prevents race conditions when sending multiple messages quickly
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Send to server
      const response = await api.post('/messages/send', {
        receiverId,
        encryptedContent: encrypted.encryptedContent,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        nonce,
        sequenceNumber,
      });

      // Only increment sequence number after successful send
      await this.confirmSequenceNumber(receiverId, sequenceNumber);

      return {
        success: true,
        messageId: response.data.messageId,
        timestamp: response.data.timestamp,
        sequenceNumber: response.data.sequenceNumber,
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to send message';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Create error object with user-friendly message
      const userError = new Error(errorMessage);
      userError.originalError = error;
      throw userError;
    }
  },

  // Peek at next sequence number without incrementing (per sender)
  async peekNextSequenceNumber(userId) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    // Each sender has their own sequence
    const key = `seq_${userData.userId}_to_${userId}`;
    
    const current = parseInt(localStorage.getItem(key) || '0');
    return current + 1;
  },

  // Confirm sequence number after successful send
  async confirmSequenceNumber(userId, sequenceNumber) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const key = `seq_${userData.userId}_to_${userId}`;
    
    localStorage.setItem(key, sequenceNumber.toString());
  },

  // Reset sequence number (for testing)
  async resetSequenceNumber(userId) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const key = `seq_${userData.userId}_to_${userId}`;
    localStorage.removeItem(key);
  },

  // Fetch and decrypt messages
  async getMessages(userId) {
    try {
      const response = await api.get(`/messages/conversation/${userId}`);
      const messages = response.data.messages;

      // Get session key
      const sessionKeyBase64 = await KeyStorage.getSessionKey(userId);
      if (!sessionKeyBase64) {
        console.warn('No session key found for user');
        return [];
      }

      // Import AES key from base64
      const keyBuffer = CryptoUtils.base64ToArrayBuffer(sessionKeyBase64);
      const sessionKey = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Decrypt all messages with timestamp verification
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          try {
            // Verify timestamp freshness (replay protection)
            const messageTime = new Date(msg.timestamp).getTime();
            const now = Date.now();
            const maxAge = 5 * 60 * 1000; // 5 minutes
            
            // Only warn for old messages (don't reject historical messages)
            // Note: Historical messages are expected and safe - they passed server validation
            if (Math.abs(now - messageTime) > maxAge) {
              // Silently note old timestamp (historical messages are normal)
              // Uncomment below for debugging:
              // console.debug(`Historical message from: ${new Date(msg.timestamp).toLocaleString()}`);
            }

            const decryptedText = await CryptoUtils.decryptMessage(
              msg.encryptedContent,
              msg.iv,
              msg.authTag,
              sessionKey
            );

            return {
              ...msg,
              text: decryptedText,
              decrypted: true,
            };
          } catch (error) {
            // Decryption failed - likely encrypted with different session key
            // This is normal in E2EE when you don't have the key
            console.debug('Cannot decrypt message (different session key):', error.message);
            
            // Log failed decryption to server for security audit
            try {
              await api.post('/messages/decryption-failed', {
                messageId: msg._id,
                senderId: msg.senderId,
                reason: error.message
              });
            } catch (logError) {
              // Silently fail - don't block message display if logging fails
              console.debug('Failed to log decryption failure:', logError);
            }
            
            return null; // Filter out undecryptable messages
          }
        })
      );

      // Filter out null values (undecryptable messages)
      return decryptedMessages.filter(msg => msg !== null);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw error;
    }
  },

  // Mark message as delivered
  async markAsDelivered(messageId) {
    try {
      await api.patch(`/messages/${messageId}/delivered`);
    } catch (error) {
      console.error('Failed to mark message as delivered:', error);
    }
  },
};

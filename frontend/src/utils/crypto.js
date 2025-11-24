// Custom E2EE Cryptography Implementation using Web Crypto API

export const CryptoUtils = {
  // Generate RSA-2048 key pair for user
  async generateRSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );
    return keyPair;
  },

  // Generate ECDSA key pair for signing
  async generateECDSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );
    return keyPair;
  },

  // Generate ECDH key pair for key exchange
  async generateECDHKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
    return keyPair;
  },

  // Export public key to base64
  async exportPublicKey(publicKey) {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    return this.arrayBufferToBase64(exported);
  },

  // Export private key to base64
  async exportPrivateKey(privateKey) {
    const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    return this.arrayBufferToBase64(exported);
  },

  // Import public key from base64
  async importPublicKey(base64Key, algorithm) {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'spki',
      keyData,
      algorithm,
      true,
      algorithm.name === 'ECDSA' ? ['verify'] : algorithm.name === 'ECDH' ? [] : ['encrypt']
    );
  },

  // Import private key from base64
  async importPrivateKey(base64Key, algorithm) {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'pkcs8',
      keyData,
      algorithm,
      true,
      algorithm.name === 'ECDSA' ? ['sign'] : algorithm.name === 'ECDH' ? ['deriveKey', 'deriveBits'] : ['decrypt']
    );
  },

  // Derive shared secret using ECDH
  async deriveSharedSecret(privateKey, publicKey) {
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      256
    );
    return sharedSecret;
  },

  // Derive AES-GCM key from shared secret using HKDF
  async deriveAESKey(sharedSecret, salt, info = 'session-key') {
    const saltBuffer = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;
    const infoBuffer = new TextEncoder().encode(info);

    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: saltBuffer,
        info: infoBuffer,
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );

    return aesKey;
  },

  // Generate random IV for AES-GCM
  generateIV() {
    return window.crypto.getRandomValues(new Uint8Array(12));
  },

  // Encrypt message with AES-256-GCM
  async encryptMessage(message, aesKey) {
    const iv = this.generateIV();
    const encodedMessage = new TextEncoder().encode(message);

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      aesKey,
      encodedMessage
    );

    const ciphertextArray = new Uint8Array(ciphertext);
    const authTag = ciphertextArray.slice(-16);
    const encryptedData = ciphertextArray.slice(0, -16);

    return {
      encryptedContent: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv),
      authTag: this.arrayBufferToBase64(authTag),
    };
  },

  // Decrypt message with AES-256-GCM
  async decryptMessage(encryptedContent, iv, authTag, aesKey) {
    const encryptedData = this.base64ToArrayBuffer(encryptedContent);
    const ivBuffer = this.base64ToArrayBuffer(iv);
    const authTagBuffer = this.base64ToArrayBuffer(authTag);

    const ciphertext = new Uint8Array(encryptedData.byteLength + authTagBuffer.byteLength);
    ciphertext.set(new Uint8Array(encryptedData), 0);
    ciphertext.set(new Uint8Array(authTagBuffer), encryptedData.byteLength);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
          tagLength: 128,
        },
        aesKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt message - integrity check failed');
    }
  },

  // Sign data with ECDSA
  async signData(data, privateKey) {
    const encodedData = new TextEncoder().encode(data);
    const signature = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      privateKey,
      encodedData
    );
    return this.arrayBufferToBase64(signature);
  },

  // Verify signature with ECDSA
  async verifySignature(data, signature, publicKey) {
    const encodedData = new TextEncoder().encode(data);
    const signatureBuffer = this.base64ToArrayBuffer(signature);

    return await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      publicKey,
      signatureBuffer,
      encodedData
    );
  },

  // Encrypt file with AES-256-GCM
  async encryptFile(fileData, aesKey) {
    const iv = this.generateIV();

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      aesKey,
      fileData
    );

    const ciphertextArray = new Uint8Array(ciphertext);
    const authTag = ciphertextArray.slice(-16);
    const encryptedData = ciphertextArray.slice(0, -16);

    return {
      encryptedData: this.arrayBufferToBase64(encryptedData),
      iv: this.arrayBufferToBase64(iv),
      authTag: this.arrayBufferToBase64(authTag),
    };
  },

  // Decrypt file with AES-256-GCM
  async decryptFile(encryptedData, iv, authTag, aesKey) {
    const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
    const ivBuffer = this.base64ToArrayBuffer(iv);
    const authTagBuffer = this.base64ToArrayBuffer(authTag);

    const ciphertext = new Uint8Array(encryptedBuffer.byteLength + authTagBuffer.byteLength);
    ciphertext.set(new Uint8Array(encryptedBuffer), 0);
    ciphertext.set(new Uint8Array(authTagBuffer), encryptedBuffer.byteLength);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
          tagLength: 128,
        },
        aesKey,
        ciphertext
      );

      return decrypted;
    } catch (error) {
      console.error('File decryption failed:', error);
      throw new Error('Failed to decrypt file - integrity check failed');
    }
  },

  // Helper: ArrayBuffer to Base64
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  // Helper: Base64 to ArrayBuffer
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  // Generate random salt
  generateSalt() {
    return window.crypto.getRandomValues(new Uint8Array(32));
  },

  // Generate nonce for replay protection
  generateNonce() {
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
    const timestamp = Date.now().toString();
    const combined = timestamp + this.arrayBufferToBase64(randomBytes);
    return this.arrayBufferToBase64(new TextEncoder().encode(combined));
  },

  // Hash data with SHA-256
  async hashData(data) {
    const encodedData = new TextEncoder().encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encodedData);
    return this.arrayBufferToBase64(hashBuffer);
  },
};

// Secure key storage using IndexedDB

const DB_NAME = 'E2EE_KeyStore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

export const KeyStorage = {
  // Initialize IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  },

  // Store private key securely
  async storePrivateKey(keyType, privateKey) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put({
        id: keyType,
        key: privateKey,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Retrieve private key
  async getPrivateKey(keyType) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(keyType);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.key);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Store session key for a specific user
  async storeSessionKey(userId, sessionKey) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put({
        id: `session_${userId}`,
        key: sessionKey,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Retrieve session key for a specific user
  async getSessionKey(userId) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(`session_${userId}`);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.key);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Clear all keys (logout)
  async clearAllKeys() {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Delete specific key
  async deleteKey(keyType) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(keyType);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

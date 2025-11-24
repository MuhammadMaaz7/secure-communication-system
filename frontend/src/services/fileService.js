import { CryptoUtils } from '../utils/crypto';
import { KeyExchangeProtocol } from './keyExchange';
import api from './api';

export const FileService = {
  // Encrypt and upload file
  async uploadFile(receiverId, file) {
    try {
      // Get session key
      const sessionKey = await KeyExchangeProtocol.getOrCreateSessionKey(receiverId);

      // Read file as ArrayBuffer
      const fileData = await file.arrayBuffer();

      // Encrypt file with AES-256-GCM
      const encrypted = await CryptoUtils.encryptFile(fileData, sessionKey);

      // Send to server
      const response = await api.post('/files/upload', {
        receiverId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      });

      return {
        success: true,
        fileId: response.data.fileId,
        timestamp: response.data.timestamp,
      };
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  },

  // Download and decrypt file
  async downloadFile(fileId, userId) {
    try {
      const response = await api.get(`/files/download/${fileId}`);
      const fileData = response.data;

      // Get session key
      const sessionKey = await KeyExchangeProtocol.getOrCreateSessionKey(userId);

      // Decrypt file
      const decryptedData = await CryptoUtils.decryptFile(
        fileData.encryptedData,
        fileData.iv,
        fileData.authTag,
        sessionKey
      );

      // Create blob and download
      const blob = new Blob([decryptedData], { type: fileData.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  },

  // Get file list
  async getFiles(userId) {
    try {
      const response = await api.get(`/files/list/${userId}`);
      return response.data.files;
    } catch (error) {
      console.error('Failed to fetch files:', error);
      throw error;
    }
  },
};

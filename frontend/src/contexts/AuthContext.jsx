import { createContext, useState, useContext, useEffect } from 'react';
import { CryptoUtils } from '../utils/crypto';
import { KeyStorage } from '../utils/keyStorage';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const register = async (username, password) => {
    try {
      // Check if user is currently logged in
      const currentUser = localStorage.getItem('userData');
      if (currentUser) {
        return {
          success: false,
          error: 'Please logout first before registering a new account.',
        };
      }

      // Generate RSA key pair for encryption
      const rsaKeyPair = await CryptoUtils.generateRSAKeyPair();
      
      // Generate ECDSA key pair for signing
      const ecdsaKeyPair = await CryptoUtils.generateECDSAKeyPair();

      // Export public keys
      const rsaPublicKey = await CryptoUtils.exportPublicKey(rsaKeyPair.publicKey);
      const ecdsaPublicKey = await CryptoUtils.exportPublicKey(ecdsaKeyPair.publicKey);

      // Combine public keys (in production, send both separately)
      const publicKey = JSON.stringify({
        rsa: rsaPublicKey,
        ecdsa: ecdsaPublicKey,
      });

      // Register with server
      const response = await api.post('/auth/register', {
        username,
        password,
        publicKey,
      });

      // Store private keys securely in IndexedDB (user-specific)
      const rsaPrivateKey = await CryptoUtils.exportPrivateKey(rsaKeyPair.privateKey);
      const ecdsaPrivateKey = await CryptoUtils.exportPrivateKey(ecdsaKeyPair.privateKey);

      // Store keys with user ID prefix for multi-user support on same device
      await KeyStorage.storePrivateKey(`${response.data.userId}_rsa_private`, rsaPrivateKey);
      await KeyStorage.storePrivateKey(`${response.data.userId}_ecdsa_private`, ecdsaPrivateKey);

      // Store auth data
      localStorage.setItem('authToken', response.data.token);
      const userData = {
        userId: response.data.userId,
        username: response.data.username,
      };
      localStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error.response?.data?.errors 
        ? error.response.data.errors.map(e => e.msg).join(', ')
        : error.response?.data?.error || 'Registration failed';
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', {
        username,
        password,
      });

      // Check if keys exist on this device for THIS user
      const userId = response.data.userId;
      const rsaPrivate = await KeyStorage.getPrivateKey(`${userId}_rsa_private`);
      const ecdsaPrivate = await KeyStorage.getPrivateKey(`${userId}_ecdsa_private`);

      // If keys don't exist, user cannot use E2EE features from this device
      if (!rsaPrivate || !ecdsaPrivate) {
        return {
          success: false,
          error: 'This account was registered on a different device. For E2EE security, you can only use this account from the original device.',
        };
      }

      localStorage.setItem('authToken', response.data.token);
      const userData = {
        userId: response.data.userId,
        username: response.data.username,
      };
      localStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  const logout = async () => {
    try {
      // Clean up pending key exchanges on server
      await api.delete('/key-exchange/cleanup');
    } catch (error) {
      console.error('Failed to cleanup key exchanges:', error);
      // Continue with logout even if cleanup fails
    }
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    // IMPORTANT: We keep keys in IndexedDB so user can login again on same device
    // Keys are PERMANENT and tied to this device - this is proper E2EE security
    // If user wants to use a different device, they need a new account
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

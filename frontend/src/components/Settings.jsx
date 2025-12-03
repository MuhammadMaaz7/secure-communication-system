import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import socketService from '../services/socketService';
import Toast from './Toast';

const Settings = () => {
  const { user, logout } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadSettings();
    
    // Ensure WebSocket connection is maintained
    const token = localStorage.getItem('authToken');
    if (token) {
      socketService.connect(token);
    }
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/2fa/status');
      setTwoFactorEnabled(response.data.twoFactorEnabled);
      setEmail(response.data.email);
    } catch (error) {
      console.error('Failed to load settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const handleToggle2FA = async () => {
    setUpdating(true);

    try {
      if (twoFactorEnabled) {
        // Disable 2FA
        await api.post('/2fa/disable');
        setTwoFactorEnabled(false);
        showToast('Two-Factor Authentication disabled', 'success');
      } else {
        // Enable 2FA
        await api.post('/2fa/enable');
        setTwoFactorEnabled(true);
        showToast('Two-Factor Authentication enabled! Check your email for confirmation.', 'success');
      }
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
      showToast(error.response?.data?.error || 'Failed to update 2FA settings', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/chat')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Account Info */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">Username</span>
                <span className="font-semibold text-gray-900">{user?.username}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-600">Email</span>
                <span className="font-semibold text-gray-900">{email}</span>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Security</h2>
            
            {/* 2FA Toggle */}
            <div className="border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
                    {twoFactorEnabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Enabled
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-4">
                    Add an extra layer of security to your account. When enabled, you'll need to enter a code sent to your email when logging in.
                  </p>
                  
                  {twoFactorEnabled ? (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="font-medium text-green-900 text-sm">Your account is protected</p>
                          <p className="text-green-700 text-xs mt-1">
                            You'll receive a verification code at <strong>{email}</strong> when logging in.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="font-medium text-yellow-900 text-sm">Recommended: Enable 2FA</p>
                          <p className="text-yellow-700 text-xs mt-1">
                            Protect your account from unauthorized access by enabling two-factor authentication.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="ml-6">
                  <button
                    onClick={handleToggle2FA}
                    disabled={updating}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      twoFactorEnabled ? 'bg-primary-600' : 'bg-gray-300'
                    } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        twoFactorEnabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {updating && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Updating settings...</span>
                </div>
              )}
            </div>

            {/* Additional Security Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Security Features</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  End-to-end encryption for all messages
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Secure key exchange protocol
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Replay attack protection
                </li>
                <li className="flex items-center gap-2">
                  <svg className={`w-4 h-4 ${twoFactorEnabled ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Two-factor authentication {!twoFactorEnabled && '(disabled)'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;

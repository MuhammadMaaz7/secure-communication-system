import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const result = await login(username, password);
      
      if (result.requiresTwoFactor) {
        // User has 2FA enabled, need to verify code
        setRequires2FA(true);
        setMaskedEmail(result.maskedEmail);
        setLoading(false);
      } else {
        // Login successful
        navigate('/chat');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');

    if (!twoFactorCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    if (twoFactorCode.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    setLoading(true);

    try {
      // Verify 2FA code
      await api.post('/2fa/verify-code', {
        username,
        code: twoFactorCode
      });

      // Code verified, complete login
      const result = await login(username, password, true); // Skip 2FA check
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);

    try {
      await api.post('/2fa/send-code', { username });
      setError('');
      alert('New code sent to your email!');
    } catch (err) {
      setError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  if (requires2FA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-[fade-in_0.6s_ease-in-out]">
            <h1 className="text-5xl font-bold text-white mb-3">SecureChat</h1>
            <p className="text-primary-100 text-lg">Two-Factor Authentication</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 animate-[slide-up_0.5s_ease-out]">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
              <p className="text-gray-600 text-sm">
                We've sent a 6-digit code to<br />
                <span className="font-semibold text-primary-600">{maskedEmail}</span>
              </p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm animate-[fade-in_0.3s_ease-in-out]">
                <p className="font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleVerify2FA} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-center text-2xl font-bold tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-500 text-center">Enter the 6-digit code from your email</p>
              </div>

              <button
                type="submit"
                disabled={loading || twoFactorCode.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <button
                onClick={handleResendCode}
                disabled={loading}
                className="text-primary-600 hover:text-primary-700 font-medium text-sm transition-colors disabled:text-gray-400"
              >
                Didn't receive the code? Resend
              </button>
              
              <div>
                <button
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode('');
                    setPassword('');
                    setError('');
                  }}
                  className="text-gray-600 hover:text-gray-700 text-sm transition-colors"
                >
                  ← Back to login
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-primary-100 text-sm animate-[fade-in_0.8s_ease-in-out]">
            <p>Secured with end-to-end encryption</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-[fade-in_0.6s_ease-in-out]">
          <h1 className="text-5xl font-bold text-white mb-3">SecureChat</h1>
          <p className="text-primary-100 text-lg">End-to-end encrypted messaging</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-[slide-up_0.5s_ease-out]">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome back</h2>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm animate-[fade-in_0.3s_ease-in-out]">
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-primary-100 text-sm animate-[fade-in_0.8s_ease-in-out]">
          <p>Secured with end-to-end encryption</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

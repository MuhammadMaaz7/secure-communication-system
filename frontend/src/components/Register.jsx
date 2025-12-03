import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = registration form, 2 = email verification
  const [sentCode, setSentCode] = useState(''); // Store the sent verification code
  const [verificationCode, setVerificationCode] = useState(''); // User input code
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (username.length < 3 || username.length > 30) {
      setError('Username must be between 3 and 30 characters');
      return;
    }

    // Validate username format (only letters, numbers, and underscores)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setError('Username can only contain letters, numbers, and underscores (no spaces)');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Send verification code to email
      const response = await api.post('/2fa/send-verification', { email });
      
      if (response.data.success) {
        setSentCode(response.data.code); // For development only
        setStep(2); // Move to verification step
        setError('');
      } else {
        setError('Failed to send verification code. Please check your email address.');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to send verification code';
      
      // Show user-friendly error messages
      if (errorMsg.includes('Email already registered')) {
        setError('This email is already registered. Please use a different email or login.');
      } else if (err.response?.status === 400) {
        setError('Invalid email address. Please check and try again.');
      } else if (err.code === 'ECONNREFUSED' || errorMsg.includes('SMTP')) {
        setError('Email service is temporarily unavailable. Please try again later.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');

    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    if (verificationCode !== sentCode) {
      setError('Invalid verification code');
      return;
    }

    setLoading(true);

    try {
      const result = await register(username, email, password);
      
      if (result.success) {
        navigate('/chat');
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/2fa/send-verification', { email });
      setSentCode(response.data.code);
      alert('New verification code sent to your email!');
    } catch (err) {
      setError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Email verification step
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-[fade-in_0.6s_ease-in-out]">
            <h1 className="text-5xl font-bold text-white mb-3">SecureChat</h1>
            <p className="text-primary-100 text-lg">Verify Your Email</p>
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
                <span className="font-semibold text-primary-600">{email}</span>
              </p>
              <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded text-xs text-yellow-800">
                <p className="font-medium">⚠️ Make sure your email is correct!</p>
                <p className="mt-1">If you don't receive the code, your email may be invalid or doesn't exist.</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm animate-[fade-in_0.3s_ease-in-out]">
                <p className="font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleVerifyEmail} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                disabled={loading || verificationCode.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating account...</span>
                  </>
                ) : (
                  'Verify & Create Account'
                )}
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <div className="text-sm text-gray-600">
                <p className="mb-2">Didn't receive the code?</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleResendCode}
                    disabled={loading}
                    className="text-primary-600 hover:text-primary-700 font-medium transition-colors disabled:text-gray-400"
                  >
                    Resend code
                  </button>
                  <button
                    onClick={() => {
                      setStep(1);
                      setVerificationCode('');
                      setError('');
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    Change email address
                  </button>
                </div>
              </div>
              
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setStep(1);
                    setVerificationCode('');
                    setError('');
                  }}
                  className="text-gray-600 hover:text-gray-700 text-sm transition-colors"
                >
                  ← Back to registration
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-primary-100 text-sm animate-[fade-in_0.8s_ease-in-out]">
            <p>Your data is encrypted and secure</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8 animate-[fade-in_0.6s_ease-in-out]">
          <h1 className="text-5xl font-bold text-white mb-3">SecureChat</h1>
          <p className="text-primary-100 text-lg">Create your encrypted account</p>
        </div>

        {/* Register Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-[slide-up_0.5s_ease-out]">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Account</h2>
          
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
                placeholder="Choose a username"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">3-30 characters, letters, numbers, and underscores only</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="your.email@example.com"
                disabled={loading}
              />
              {/* <p className="mt-1 text-xs text-gray-500">Required for 2FA (optional feature)</p> */}
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
                placeholder="Create a strong password"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="Confirm your password"
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
                  <span>Creating account...</span>
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Security Features */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3 font-medium">Your account includes:</p>
            <ul className="space-y-2 text-xs text-gray-600 list-disc list-inside">
              <li>End-to-end encryption</li>
              <li>Secure key exchange protocol</li>
              <li>Zero-knowledge architecture</li>
            </ul>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-6 text-center text-primary-100 text-sm animate-[fade-in_0.8s_ease-in-out]">
          <p>Your data is encrypted and secure</p>
        </div>
      </div>
    </div>
  );
};

export default Register;

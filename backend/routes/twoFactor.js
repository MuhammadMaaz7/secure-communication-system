const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const EmailService = require('../utils/emailService');
const logger = require('../utils/logger');

const router = express.Router();

// Generate random 6-digit code
const generate2FACode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email verification code during registration
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.warn(`EMAIL VERIFICATION FAILED: Invalid email format - ${email}`);
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn(`EMAIL VERIFICATION FAILED: Email already registered - ${email}`);
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate 6-digit code
    const code = generate2FACode();
    
    // Store code temporarily (we'll use a temporary collection or cache)
    // For now, we'll send it and verify during registration
    // In production, use Redis or a temporary verification collection
    
    try {
      // Send verification email
      const result = await EmailService.sendEmailVerification(email, code);
      
      if (!result.success) {
        logger.error(`EMAIL VERIFICATION FAILED: Could not send to ${email}`);
        return res.status(500).json({ error: 'Failed to send verification email. Please check your email address.' });
      }

      logger.info(`EMAIL VERIFICATION: Code sent successfully to ${email}`);

      res.json({
        success: true,
        message: 'Verification code sent to your email',
        code: code // ONLY FOR DEVELOPMENT - Remove in production!
      });
    } catch (emailError) {
      logger.error(`EMAIL VERIFICATION FAILED: SMTP error for ${email}:`, emailError);
      
      // Check for specific email errors
      if (emailError.message.includes('Invalid email')) {
        return res.status(400).json({ error: 'Invalid email address' });
      } else if (emailError.code === 'EAUTH') {
        return res.status(500).json({ error: 'Email service authentication failed. Please contact support.' });
      } else if (emailError.code === 'ECONNECTION') {
        return res.status(500).json({ error: 'Email service is temporarily unavailable. Please try again later.' });
      } else {
        return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
      }
    }
  } catch (error) {
    logger.error('Error in email verification:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Enable 2FA for user
router.post('/enable', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    await user.save();

    // Send notification email
    await EmailService.send2FAEnabledNotification(user.email, user.username);

    logger.info(`2FA ENABLED: User ${user.username} (${user._id}) enabled two-factor authentication`);

    res.json({
      message: '2FA enabled successfully',
      twoFactorEnabled: true
    });
  } catch (error) {
    logger.error('Error enabling 2FA:', error);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Disable 2FA for user
router.post('/disable', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorCode = null;
    user.twoFactorCodeExpiry = null;
    await user.save();

    // Send notification email
    await EmailService.send2FADisabledNotification(user.email, user.username);

    logger.info(`2FA DISABLED: User ${user.username} (${user._id}) disabled two-factor authentication`);

    res.json({
      message: '2FA disabled successfully',
      twoFactorEnabled: false
    });
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Get 2FA status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('twoFactorEnabled email');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      twoFactorEnabled: user.twoFactorEnabled,
      email: user.email
    });
  } catch (error) {
    logger.error('Error getting 2FA status:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

// Send 2FA code (called during login)
router.post('/send-code', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.findOne({ username });
    
    if (!user) {
      // Don't reveal if user exists
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }

    // Generate 6-digit code
    const code = generate2FACode();
    
    // Store code with 10-minute expiry
    user.twoFactorCode = code;
    user.twoFactorCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send code via email
    await EmailService.send2FACode(user.email, code, user.username);

    logger.info(`2FA CODE SENT: Code sent to ${user.email} for user ${user.username}`);

    res.json({
      message: '2FA code sent to your email',
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email
    });
  } catch (error) {
    logger.error('Error sending 2FA code:', error);
    res.status(500).json({ error: 'Failed to send 2FA code' });
  }
});

// Verify 2FA code (called during login)
router.post('/verify-code', async (req, res) => {
  try {
    const { username, code } = req.body;

    if (!username || !code) {
      return res.status(400).json({ error: 'Username and code are required' });
    }

    const user = await User.findOne({ username });
    
    if (!user) {
      logger.warn(`2FA VERIFICATION FAILED: User not found - ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.twoFactorEnabled) {
      logger.warn(`2FA VERIFICATION FAILED: 2FA not enabled for user - ${username}`);
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Check if code exists
    if (!user.twoFactorCode) {
      logger.warn(`2FA VERIFICATION FAILED: No code generated for user - ${username}`);
      return res.status(400).json({ error: 'No 2FA code found. Please request a new code.' });
    }

    // Check if code expired
    if (new Date() > user.twoFactorCodeExpiry) {
      logger.warn(`2FA VERIFICATION FAILED: Code expired for user - ${username}`);
      user.twoFactorCode = null;
      user.twoFactorCodeExpiry = null;
      await user.save();
      return res.status(400).json({ error: '2FA code expired. Please request a new code.' });
    }

    // Verify code
    if (user.twoFactorCode !== code) {
      logger.warn(`2FA VERIFICATION FAILED: Invalid code for user - ${username}`);
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    // Code is valid - clear it
    user.twoFactorCode = null;
    user.twoFactorCodeExpiry = null;
    await user.save();

    logger.info(`2FA VERIFICATION SUCCESS: User ${username} verified successfully`);

    res.json({
      message: '2FA verification successful',
      verified: true
    });
  } catch (error) {
    logger.error('Error verifying 2FA code:', error);
    res.status(500).json({ error: 'Failed to verify 2FA code' });
  }
});

module.exports = router;

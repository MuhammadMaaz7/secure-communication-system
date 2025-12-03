const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { validateRegistration, validateLogin } = require('../middleware/validation');

const router = express.Router();

router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { username, password, publicKey, email } = req.body;

    logger.info(`Registration attempt for username: ${username}, email: ${email}`);

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      if (existingUser.username === username) {
        logger.warn(`Registration failed: Username already exists - ${username}`);
        return res.status(400).json({ error: 'Username already exists' });
      }
      if (existingUser.email === email) {
        logger.warn(`Registration failed: Email already exists - ${email}`);
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const passwordHash = await User.hashPassword(password);

    const user = new User({
      username,
      email,
      passwordHash,
      publicKey
    });

    await user.save();

    logger.info(`AUTHENTICATION: New user registered - username=${username}, userId=${user._id}`);

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      userId: user._id,
      username: user.username
    });
  } catch (error) {
    logger.error('Registration error:', error);
    logger.error('Error details:', error.message);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      logger.warn(`AUTHENTICATION FAILED: Invalid username - ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn(`AUTHENTICATION FAILED: Invalid password for user - ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`AUTHENTICATION SUCCESS: User logged in - username=${username}, userId=${user._id}`);

    res.json({
      message: 'Login successful',
      token,
      userId: user._id,
      username: user.username,
      publicKey: user.publicKey,
      twoFactorEnabled: user.twoFactorEnabled,
      requiresTwoFactor: user.twoFactorEnabled
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;

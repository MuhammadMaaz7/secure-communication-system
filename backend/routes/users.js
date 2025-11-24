const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/list', authMiddleware, async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.userId } },
      'username publicKey createdAt'
    );

    res.json({ users });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/:userId/public-key', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId, 'publicKey username');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userId: user._id,
      username: user.username,
      publicKey: user.publicKey
    });
  } catch (error) {
    logger.error('Error fetching public key:', error);
    res.status(500).json({ error: 'Failed to fetch public key' });
  }
});

router.put('/update-keys', authMiddleware, async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: 'Public key is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { publicKey },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`Public keys updated for user: ${user.username}`);

    res.json({
      message: 'Public keys updated successfully',
      userId: user._id
    });
  } catch (error) {
    logger.error('Error updating public keys:', error);
    res.status(500).json({ error: 'Failed to update public keys' });
  }
});

module.exports = router;

const express = require('express');
const crypto = require('crypto');
const Message = require('../models/Message');
const MessageCounter = require('../models/MessageCounter');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Store recently seen nonces (in-memory cache, use Redis in production)
const recentNonces = new Set();
const NONCE_EXPIRY = 5 * 60 * 1000; // 5 minutes

router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { receiverId, encryptedContent, iv, authTag, nonce, sequenceNumber } = req.body;

    if (!receiverId || !encryptedContent || !iv || !authTag || !nonce || sequenceNumber === undefined) {
      logger.warn(`Message send failed: Missing required fields from ${req.userId}`);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Replay Attack Protection #1: Check nonce uniqueness
    if (recentNonces.has(nonce)) {
      logger.warn(`REPLAY ATTACK DETECTED: Duplicate nonce ${nonce} from ${req.userId}`);
      return res.status(400).json({ error: 'Duplicate nonce - possible replay attack' });
    }

    // Check if nonce already exists in database
    const existingMessage = await Message.findOne({ nonce });
    if (existingMessage) {
      logger.warn(`REPLAY ATTACK DETECTED: Nonce ${nonce} already in database from ${req.userId}`);
      return res.status(400).json({ error: 'Message already processed - replay attack detected' });
    }

    // Replay Attack Protection #2: Verify sequence number (per sender)
    // Each sender has their own sequence counter
    const senderKey = `${req.userId}_to_${receiverId}`;
    const counter = await MessageCounter.findOne({ conversationId: senderKey });
    const expectedSequence = counter ? counter.counter + 1 : 1;
    
    if (sequenceNumber !== expectedSequence) {
      logger.warn(`REPLAY ATTACK DETECTED: Invalid sequence number ${sequenceNumber}, expected ${expectedSequence} from ${req.userId}`);
      return res.status(400).json({ error: 'Invalid sequence number - possible replay attack' });
    }
    
    // Update the sender's counter
    await MessageCounter.findOneAndUpdate(
      { conversationId: senderKey },
      { $set: { counter: sequenceNumber } },
      { upsert: true }
    );

    // Replay Attack Protection #3: Store timestamp for verification
    const messageTimestamp = new Date();

    const message = new Message({
      senderId: req.userId,
      receiverId,
      encryptedContent,
      iv,
      authTag,
      nonce,
      sequenceNumber,
      timestamp: messageTimestamp
    });

    await message.save();

    // Add nonce to recent cache
    recentNonces.add(nonce);
    setTimeout(() => recentNonces.delete(nonce), NONCE_EXPIRY);

    logger.info(`Message sent from ${req.userId} to ${receiverId}, seq: ${sequenceNumber}, nonce: ${nonce.substring(0, 8)}...`);

    res.status(201).json({
      message: 'Message sent successfully',
      messageId: message._id,
      timestamp: message.timestamp,
      sequenceNumber: message.sequenceNumber
    });
  } catch (error) {
    if (error.code === 11000) {
      logger.warn(`REPLAY ATTACK DETECTED: Duplicate nonce in database from ${req.userId}`);
      return res.status(400).json({ error: 'Duplicate message - replay attack detected' });
    }
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { senderId: req.userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: req.userId }
      ]
    })
    .sort({ timestamp: 1 })  // Sort by timestamp for display order
    .select('senderId receiverId encryptedContent iv authTag nonce sequenceNumber timestamp delivered read');

    logger.info(`Messages fetched for conversation between ${req.userId} and ${otherUserId}, count: ${messages.length}`);

    res.json({ messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.patch('/:messageId/delivered', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { _id: req.params.messageId, receiverId: req.userId },
      { delivered: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: 'Message marked as delivered' });
  } catch (error) {
    logger.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Log failed decryption attempts (for security auditing)
router.post('/decryption-failed', authMiddleware, async (req, res) => {
  try {
    const { messageId, senderId, reason } = req.body;

    if (!messageId || !senderId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log the failed decryption attempt
    logger.warn(`DECRYPTION FAILED: User ${req.userId} failed to decrypt message ${messageId} from ${senderId}, reason: ${reason || 'unknown'}`);

    res.json({ message: 'Decryption failure logged' });
  } catch (error) {
    logger.error('Error logging decryption failure:', error);
    res.status(500).json({ error: 'Failed to log decryption failure' });
  }
});

module.exports = router;

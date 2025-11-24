const express = require('express');
const crypto = require('crypto');
const KeyExchange = require('../models/KeyExchange');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { responderId, publicKey, signature, timestamp } = req.body;

    if (!responderId || !publicKey || !signature || !timestamp) {
      logger.warn(`Key exchange initiation failed: Missing fields from ${req.userId}`);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify timestamp freshness (prevent replay)
    const now = Date.now();
    const messageTime = parseInt(timestamp);
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (Math.abs(now - messageTime) > maxAge) {
      logger.warn(`Key exchange initiation failed: Stale timestamp from ${req.userId}, age: ${Math.abs(now - messageTime)}ms`);
      return res.status(400).json({ error: 'Timestamp too old - possible replay attack' });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const keyExchange = new KeyExchange({
      initiatorId: req.userId,
      responderId,
      initiatorPublicKey: publicKey,
      initiatorSignature: signature,
      sessionId,
      expiresAt,
      status: 'pending'
    });

    await keyExchange.save();

    logger.info(`Key exchange initiated: session=${sessionId}, initiator=${req.userId}, responder=${responderId}`);

    res.status(201).json({
      message: 'Key exchange initiated',
      sessionId,
      expiresAt
    });
  } catch (error) {
    logger.error('Error initiating key exchange:', error);
    res.status(500).json({ error: 'Failed to initiate key exchange' });
  }
});

router.post('/respond', authMiddleware, async (req, res) => {
  try {
    const { sessionId, publicKey, signature, timestamp } = req.body;

    if (!sessionId || !publicKey || !signature || !timestamp) {
      logger.warn(`Key exchange response failed: Missing fields from ${req.userId}`);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify timestamp freshness
    const now = Date.now();
    const messageTime = parseInt(timestamp);
    const maxAge = 5 * 60 * 1000;

    if (Math.abs(now - messageTime) > maxAge) {
      logger.warn(`Key exchange response failed: Stale timestamp from ${req.userId}`);
      return res.status(400).json({ error: 'Timestamp too old - possible replay attack' });
    }

    const keyExchange = await KeyExchange.findOne({
      sessionId,
      responderId: req.userId,
      status: 'pending'
    });

    if (!keyExchange) {
      logger.warn(`Key exchange response failed: Session not found ${sessionId} for ${req.userId}`);
      return res.status(404).json({ error: 'Key exchange session not found or expired' });
    }

    if (new Date() > keyExchange.expiresAt) {
      keyExchange.status = 'failed';
      await keyExchange.save();
      logger.warn(`Key exchange response failed: Session expired ${sessionId}`);
      return res.status(400).json({ error: 'Key exchange session expired' });
    }

    keyExchange.responderPublicKey = publicKey;
    keyExchange.responderSignature = signature;
    keyExchange.status = 'completed';
    await keyExchange.save();

    logger.info(`Key exchange completed: session=${sessionId}, responder=${req.userId}`);

    res.json({
      message: 'Key exchange completed',
      initiatorPublicKey: keyExchange.initiatorPublicKey,
      initiatorSignature: keyExchange.initiatorSignature
    });
  } catch (error) {
    logger.error('Error responding to key exchange:', error);
    res.status(500).json({ error: 'Failed to respond to key exchange' });
  }
});

router.get('/pending', authMiddleware, async (req, res) => {
  try {
    // Clean up expired exchanges first
    await KeyExchange.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    const pendingExchanges = await KeyExchange.find({
      responderId: req.userId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
    .populate('initiatorId', 'username')
    .select('sessionId initiatorPublicKey initiatorSignature timestamp');

    res.json({ pendingExchanges });
  } catch (error) {
    logger.error('Error fetching pending exchanges:', error);
    res.status(500).json({ error: 'Failed to fetch pending exchanges' });
  }
});

router.get('/status/:sessionId', authMiddleware, async (req, res) => {
  try {
    const keyExchange = await KeyExchange.findOne({
      sessionId: req.params.sessionId,
      $or: [
        { initiatorId: req.userId },
        { responderId: req.userId }
      ]
    });

    if (!keyExchange) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const response = {
      status: keyExchange.status,
      sessionId: keyExchange.sessionId
    };

    if (keyExchange.status === 'completed' && keyExchange.initiatorId.toString() === req.userId) {
      response.responderPublicKey = keyExchange.responderPublicKey;
      response.responderSignature = keyExchange.responderSignature;
    }

    res.json(response);
  } catch (error) {
    logger.error('Error checking key exchange status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Key confirmation endpoint
router.post('/confirm', authMiddleware, async (req, res) => {
  try {
    const { userId, sessionId, encryptedConfirmation, iv, authTag } = req.body;

    if (!userId || !sessionId || !encryptedConfirmation || !iv || !authTag) {
      logger.warn(`Key confirmation failed: Missing fields from ${req.userId}`);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the session exists and is completed
    const keyExchange = await KeyExchange.findOne({
      sessionId,
      status: 'completed',
      $or: [
        { initiatorId: req.userId, responderId: userId },
        { responderId: req.userId, initiatorId: userId }
      ]
    });

    if (!keyExchange) {
      logger.warn(`Key confirmation failed: Session not found ${sessionId}`);
      return res.status(404).json({ error: 'Key exchange session not found' });
    }

    // Store confirmation data (for audit purposes)
    keyExchange.confirmationReceived = true;
    keyExchange.confirmationTimestamp = new Date();
    await keyExchange.save();

    logger.info(`Key confirmation received: session=${sessionId}, from=${req.userId}`);

    res.json({
      message: 'Key confirmation received',
      sessionId
    });
  } catch (error) {
    logger.error('Error processing key confirmation:', error);
    res.status(500).json({ error: 'Failed to process key confirmation' });
  }
});

// Clean up pending key exchanges for a user (called on logout or key regeneration)
router.delete('/cleanup', authMiddleware, async (req, res) => {
  try {
    // Delete all pending key exchanges where user is initiator
    const result = await KeyExchange.deleteMany({
      initiatorId: req.userId,
      status: 'pending'
    });

    logger.info(`Cleaned up ${result.deletedCount} pending key exchanges for user ${req.userId}`);

    res.json({
      message: 'Pending key exchanges cleaned up',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Error cleaning up key exchanges:', error);
    res.status(500).json({ error: 'Failed to cleanup key exchanges' });
  }
});

module.exports = router;

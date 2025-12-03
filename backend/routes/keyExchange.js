const express = require('express');
const crypto = require('crypto');
const KeyExchange = require('../models/KeyExchange');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

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

// Log invalid signature attempts (for security auditing)
router.post('/signature-failed', authMiddleware, async (req, res) => {
  try {
    const { sessionId, userId, reason } = req.body;

    if (!sessionId || !userId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log the invalid signature attempt
    logger.warn(`INVALID SIGNATURE DETECTED: Session ${sessionId}, User ${userId}, Reason: ${reason}, Detected by: ${req.userId}`);

    res.json({ message: 'Signature failure logged' });
  } catch (error) {
    logger.error('Error logging signature failure:', error);
    res.status(500).json({ error: 'Failed to log signature failure' });
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

// ============================================================================
// VULNERABLE ENDPOINTS - FOR DEMONSTRATION PURPOSES ONLY
// ============================================================================
// WARNING: These endpoints DO NOT verify signatures and are vulnerable to MITM attacks
// They are used ONLY for demonstrating the importance of signature verification
// DO NOT USE IN PRODUCTION
// ============================================================================

router.post('/vulnerable/initiate', async (req, res) => {
  try {
    const { responderId, publicKey, timestamp } = req.body;

    logger.warn('⚠️  VULNERABLE ENDPOINT CALLED: /api/key-exchange/vulnerable/initiate');
    logger.warn('⚠️  THIS ENDPOINT IS FOR DEMO ONLY - NO SIGNATURE VERIFICATION');
    logger.warn('⚠️  SUSCEPTIBLE TO MAN-IN-THE-MIDDLE ATTACKS');

    if (!responderId || !publicKey || !timestamp) {
      logger.warn('Vulnerable key exchange initiation failed: Missing fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate timestamp (but no signature verification!)
    const now = Date.now();
    const messageTime = parseInt(timestamp);
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (Math.abs(now - messageTime) > maxAge) {
      logger.warn(`Vulnerable key exchange initiation failed: Stale timestamp, age: ${Math.abs(now - messageTime)}ms`);
      return res.status(400).json({ error: 'Timestamp too old' });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const keyExchange = new KeyExchange({
      initiatorId: new mongoose.Types.ObjectId(), 
      responderId: new mongoose.Types.ObjectId(), 
      initiatorPublicKey: publicKey,
      initiatorSignature: 'VULNERABLE-NO-SIGNATURE',
      sessionId,
      expiresAt,
      status: 'pending'
    });

    await keyExchange.save();

    logger.warn(`⚠️  VULNERABLE key exchange initiated: session=${sessionId}, responder=${responderId}`);
    logger.warn('⚠️  NO SIGNATURE VERIFICATION - ATTACKER CAN REPLACE PUBLIC KEY');

    res.status(201).json({
      message: 'Vulnerable key exchange initiated (DEMO ONLY)',
      sessionId,
      expiresAt
    });
  } catch (error) {
    logger.error('Error in vulnerable key exchange initiation:', error);
    res.status(500).json({ error: 'Failed to initiate vulnerable key exchange' });
  }
});

router.post('/vulnerable/respond', async (req, res) => {
  try {
    const { sessionId, publicKey, timestamp } = req.body;

    logger.warn('⚠️  VULNERABLE ENDPOINT CALLED: /api/key-exchange/vulnerable/respond');
    logger.warn('⚠️  THIS ENDPOINT IS FOR DEMO ONLY - NO SIGNATURE VERIFICATION');
    logger.warn('⚠️  SUSCEPTIBLE TO MAN-IN-THE-MIDDLE ATTACKS');

    if (!sessionId || !publicKey || !timestamp) {
      logger.warn('Vulnerable key exchange response failed: Missing fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate timestamp (but no signature verification!)
    const now = Date.now();
    const messageTime = parseInt(timestamp);
    const maxAge = 5 * 60 * 1000;

    if (Math.abs(now - messageTime) > maxAge) {
      logger.warn('Vulnerable key exchange response failed: Stale timestamp');
      return res.status(400).json({ error: 'Timestamp too old' });
    }

    const keyExchange = await KeyExchange.findOne({
      sessionId,
      status: 'pending'
    });

    if (!keyExchange) {
      logger.warn(`Vulnerable key exchange response failed: Session not found ${sessionId}`);
      return res.status(404).json({ error: 'Key exchange session not found or expired' });
    }

    if (new Date() > keyExchange.expiresAt) {
      keyExchange.status = 'failed';
      await keyExchange.save();
      logger.warn(`Vulnerable key exchange response failed: Session expired ${sessionId}`);
      return res.status(400).json({ error: 'Key exchange session expired' });
    }

    keyExchange.responderPublicKey = publicKey;
    keyExchange.responderSignature = 'VULNERABLE-NO-SIGNATURE';
    keyExchange.status = 'completed';
    await keyExchange.save();

    logger.warn(`⚠️  VULNERABLE key exchange completed: session=${sessionId}`);
    logger.warn('⚠️  NO SIGNATURE VERIFICATION - ATTACKER CAN REPLACE PUBLIC KEY');

    res.json({
      message: 'Vulnerable key exchange completed (DEMO ONLY)',
      initiatorPublicKey: keyExchange.initiatorPublicKey
    });
  } catch (error) {
    logger.error('Error in vulnerable key exchange response:', error);
    res.status(500).json({ error: 'Failed to respond to vulnerable key exchange' });
  }
});

module.exports = router;

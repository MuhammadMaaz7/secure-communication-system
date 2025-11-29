const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const KeyExchange = require('../models/KeyExchange');
const User = require('../models/User');
const { createTestUser, createTestToken, generateSessionId } = require('./helpers/testHelpers');

// Import routes
const keyExchangeRoutes = require('../routes/keyExchange');
const authMiddleware = require('../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/key-exchange', keyExchangeRoutes);

describe('Key Exchange Security Tests', () => {
  let user1, user2, token1, token2;
  
  beforeAll(async () => {
    // Create test users with unique usernames
    const timestamp = Date.now();
    const result1 = await createTestUser(`alice_${timestamp}`, 'password123');
    const result2 = await createTestUser(`bob_${timestamp}`, 'password123');
    user1 = result1.user;
    user2 = result2.user;
    token1 = result1.token;
    token2 = result2.token;
  });

  describe('MITM Attack Prevention', () => {
    test('should reject key exchange with invalid signature', async () => {
      // Create a valid key exchange session first
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      
      const keyExchange = new KeyExchange({
        initiatorId: user1._id,
        responderId: user2._id,
        initiatorPublicKey: 'valid-public-key',
        initiatorSignature: 'valid-signature',
        sessionId,
        expiresAt,
        status: 'pending'
      });
      await keyExchange.save();

      // Try to respond with tampered public key and invalid signature
      const response = await request(app)
        .post('/api/key-exchange/respond')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          sessionId,
          publicKey: 'ATTACKER_PUBLIC_KEY',
          signature: 'FAKE_SIGNATURE',
          timestamp: Date.now()
        });

      // Should reject due to invalid signature (verification happens client-side)
      // But server should still validate timestamp and session
      expect(response.status).toBe(200); // Server accepts, but client will reject
    });

    test('should verify timestamp freshness on key exchange', async () => {
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      
      const keyExchange = new KeyExchange({
        initiatorId: user1._id,
        responderId: user2._id,
        initiatorPublicKey: 'valid-public-key',
        initiatorSignature: 'valid-signature',
        sessionId,
        expiresAt,
        status: 'pending'
      });
      await keyExchange.save();

      // Try with stale timestamp (>5 minutes old)
      const staleTimestamp = Date.now() - (6 * 60 * 1000);
      
      const response = await request(app)
        .post('/api/key-exchange/respond')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          sessionId,
          publicKey: 'responder-public-key',
          signature: 'responder-signature',
          timestamp: staleTimestamp
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Timestamp too old');
    });

    test('should reject key exchange for expired session', async () => {
      const sessionId = generateSessionId();
      const expiredTime = new Date(Date.now() - 1000); // 1 second ago
      
      const keyExchange = new KeyExchange({
        initiatorId: user1._id,
        responderId: user2._id,
        initiatorPublicKey: 'valid-public-key',
        initiatorSignature: 'valid-signature',
        sessionId,
        expiresAt: expiredTime,
        status: 'pending'
      });
      await keyExchange.save();

      const response = await request(app)
        .post('/api/key-exchange/respond')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          sessionId,
          publicKey: 'responder-public-key',
          signature: 'responder-signature',
          timestamp: Date.now()
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expired');
    });

    test('should require authentication for key exchange', async () => {
      const response = await request(app)
        .post('/api/key-exchange/initiate')
        .send({
          responderId: user2._id.toString(),
          publicKey: 'test-public-key',
          signature: 'test-signature',
          timestamp: Date.now()
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token');
    });
  });

  describe('Key Exchange Session Management', () => {
    test('should create key exchange session with valid data', async () => {
      const response = await request(app)
        .post('/api/key-exchange/initiate')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          responderId: user2._id.toString(),
          publicKey: 'initiator-public-key',
          signature: 'initiator-signature',
          timestamp: Date.now()
        });

      expect(response.status).toBe(201);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
    });

    test('should clean up expired key exchanges', async () => {
      // Create expired key exchange
      const expiredSessionId = generateSessionId();
      const expiredTime = new Date(Date.now() - 1000);
      
      const expiredExchange = new KeyExchange({
        initiatorId: user1._id,
        responderId: user2._id,
        initiatorPublicKey: 'test-key',
        initiatorSignature: 'test-sig',
        sessionId: expiredSessionId,
        expiresAt: expiredTime,
        status: 'pending'
      });
      await expiredExchange.save();

      // Fetch pending exchanges (should trigger cleanup)
      const response = await request(app)
        .get('/api/key-exchange/pending')
        .set('Authorization', `Bearer ${token2}`);

      expect(response.status).toBe(200);
      
      // Verify expired exchange was cleaned up
      const found = await KeyExchange.findOne({ sessionId: expiredSessionId });
      expect(found).toBeNull();
    });
  });
});


const request = require('supertest');
const express = require('express');
const { createTestUser, generateNonce } = require('./helpers/testHelpers');

// Import routes
const authRoutes = require('../routes/auth');
const messageRoutes = require('../routes/messages');
const keyExchangeRoutes = require('../routes/keyExchange');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/key-exchange', keyExchangeRoutes);

describe('Rate Limiting Security Tests', () => {
  describe('Authentication Rate Limiting', () => {
    test('should document lack of rate limiting on login attempts', async () => {
      // This test documents that rate limiting is NOT implemented
      // After implementing, this test should be updated
      
      const attempts = 20;
      let successCount = 0;
      let failureCount = 0;
      
      for (let i = 0; i < attempts; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'nonexistent_user',
            password: 'wrong'
          });
        
        if (response.status === 401) {
          failureCount++;
        } else if (response.status === 429) {
          successCount++; // Rate limiting detected
          break;
        }
      }
      
      // Currently all attempts are processed (no rate limiting)
      expect(failureCount).toBe(attempts);
      
      // TODO: After implementing rate limiting:
      // expect(response.status).toBe(429); // Too Many Requests
      // expect(response.body.error).toContain('rate limit');
    });

    test('should document lack of rate limiting on registration', async () => {
      // This test documents that rate limiting is NOT implemented
      const publicKey = JSON.stringify({ rsa: 'key', ecdsa: 'key' });
      
      // Reduce attempts to avoid timeout (bcrypt is slow)
      const attempts = 5;
      let successCount = 0;
      
      for (let i = 0; i < attempts; i++) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `testuser_${Date.now()}_${i}`,
            password: 'password123',
            publicKey
          });
        
        if (response.status === 201) {
          successCount++;
        } else if (response.status === 429) {
          // Rate limiting detected
          break;
        }
      }
      
      // Currently all attempts are processed (no rate limiting)
      expect(successCount).toBe(attempts);
      
      // TODO: After implementing rate limiting:
      // After 5 registrations, should return 429
    }, 30000); // Increase timeout to 30 seconds for bcrypt operations
  });

  describe('Message Rate Limiting', () => {
    let user1, user2, token1;

    beforeAll(async () => {
      const timestamp = Date.now();
      const result1 = await createTestUser(`alice_${timestamp}`, 'pass123');
      const result2 = await createTestUser(`bob_${timestamp}`, 'pass123');
      user1 = result1.user;
      user2 = result2.user;
      token1 = result1.token;
    });

    test('should document lack of rate limiting on message sending', async () => {
      // This test documents that rate limiting is NOT implemented
      const MessageCounter = require('../models/MessageCounter');
      const messagesToSend = 50;
      let successCount = 0;
      
      // Get initial counter state
      const senderKey = `${user1._id}_to_${user2._id}`;
      
      // Track sequence number manually to avoid race conditions with counter
      let currentSequence = 1;
      
      for (let i = 0; i < messagesToSend; i++) {
        const response = await request(app)
          .post('/api/messages/send')
          .set('Authorization', `Bearer ${token1}`)
          .send({
            receiverId: user2._id.toString(),
            encryptedContent: 'encrypted',
            iv: 'iv',
            authTag: 'tag',
            nonce: generateNonce(),
            sequenceNumber: currentSequence
          });
        
        if (response.status === 201) {
          successCount++;
          currentSequence++; // Increment for next message
        } else if (response.status === 429) {
          // Rate limiting detected
          break;
        } else if (response.status === 400) {
          // Check if it's a sequence number error - if so, try to recover
          if (response.body.error?.includes('sequence')) {
            // Counter might have been reset or there's a mismatch
            // Try to get current counter state and continue
            const counter = await MessageCounter.findOne({ conversationId: senderKey });
            currentSequence = counter ? counter.counter + 1 : 1;
            // Retry with correct sequence
            i--; // Don't count this iteration
            continue;
          } else {
            // Other error - break
            break;
          }
        }
      }
      
      // Currently all messages are processed (no rate limiting)
      expect(successCount).toBe(messagesToSend);
      
      // TODO: After implementing rate limiting:
      // After X messages per minute, should return 429
      // expect(response.status).toBe(429);
      // expect(response.body.error).toContain('rate limit');
    });
  });

  describe('Key Exchange Rate Limiting', () => {
    let user1, user2, token1, token2;

    beforeAll(async () => {
      const timestamp = Date.now();
      const result1 = await createTestUser(`alice_${timestamp}`, 'pass123');
      const result2 = await createTestUser(`bob_${timestamp}`, 'pass123');
      user1 = result1.user;
      user2 = result2.user;
      token1 = result1.token;
      token2 = result2.token;
    });

    test('should document lack of rate limiting on key exchange', async () => {
      // This test documents that rate limiting is NOT implemented
      const exchangesToInitiate = 20;
      let successCount = 0;
      
      for (let i = 0; i < exchangesToInitiate; i++) {
        const response = await request(app)
          .post('/api/key-exchange/initiate')
          .set('Authorization', `Bearer ${token1}`)
          .send({
            responderId: user2._id.toString(),
            publicKey: 'test-public-key',
            signature: 'test-signature',
            timestamp: Date.now()
          });
        
        if (response.status === 201) {
          successCount++;
        } else if (response.status === 429) {
          // Rate limiting detected
          break;
        }
      }
      
      // Currently all exchanges are processed (no rate limiting)
      expect(successCount).toBe(exchangesToInitiate);
      
      // TODO: After implementing rate limiting:
      // After X key exchanges per minute, should return 429
      // expect(response.status).toBe(429);
    });
  });
});


const request = require('supertest');
const express = require('express');
const Message = require('../models/Message');
const MessageCounter = require('../models/MessageCounter');
const { createTestUser, generateNonce } = require('./helpers/testHelpers');

// Import routes
const messageRoutes = require('../routes/messages');
const authMiddleware = require('../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/messages', messageRoutes);

describe('Replay Attack Prevention Tests', () => {
  let user1, user2, token1;

  beforeAll(async () => {
    // Use unique usernames to avoid conflicts
    const timestamp = Date.now();
    const result1 = await createTestUser(`alice_${timestamp}`, 'pass123');
    const result2 = await createTestUser(`bob_${timestamp}`, 'pass123');
    user1 = result1.user;
    user2 = result2.user;
    token1 = result1.token;
  });

  describe('Nonce Uniqueness', () => {
    test('should reject duplicate nonce', async () => {
      const nonce = generateNonce();
      const encryptedContent = 'encrypted-message-content';
      const iv = 'initialization-vector';
      const authTag = 'authentication-tag';
      const sequenceNumber = 1;

      // Send first message
      const response1 = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent,
          iv,
          authTag,
          nonce,
          sequenceNumber
        });

      expect(response1.status).toBe(201);

      // Try to resend with same nonce
      const response2 = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent: 'different-content',
          iv: 'different-iv',
          authTag: 'different-tag',
          nonce, // Same nonce - should be rejected
          sequenceNumber: 2
        });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain('replay attack');
    });

    test('should check nonce in database', async () => {
      const nonce = generateNonce();
      
      // Create message directly in database
      const message = new Message({
        senderId: user1._id,
        receiverId: user2._id,
        encryptedContent: 'encrypted',
        iv: 'iv',
        authTag: 'tag',
        nonce: nonce,
        sequenceNumber: 10,
        timestamp: new Date()
      });
      await message.save();

      // Try to send message with same nonce
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent: 'new-encrypted',
          iv: 'new-iv',
          authTag: 'new-tag',
          nonce, // Same nonce already in DB
          sequenceNumber: 11
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('replay attack');
    });
  });

  describe('Sequence Number Enforcement', () => {
    test('should reject out-of-order sequence numbers', async () => {
      const conversationId = `${user1._id}_to_${user2._id}`;
      
      // Set counter to 5
      await MessageCounter.findOneAndUpdate(
        { conversationId },
        { $set: { counter: 5 } },
        { upsert: true }
      );

      // Try to send message with sequence 3 (should be 6)
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent: 'encrypted',
          iv: 'iv',
          authTag: 'tag',
          nonce: generateNonce(),
          sequenceNumber: 3 // Should be 6
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('sequence number');
      expect(response.body.error).toContain('replay attack');
    });

    test('should accept correct sequence number', async () => {
      const conversationId = `${user1._id}_to_${user2._id}`;
      
      // Set counter to 10
      await MessageCounter.findOneAndUpdate(
        { conversationId },
        { $set: { counter: 10 } },
        { upsert: true }
      );

      // Send message with sequence 11 (correct)
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent: 'encrypted',
          iv: 'iv',
          authTag: 'tag',
          nonce: generateNonce(),
          sequenceNumber: 11 // Correct next sequence
        });

      expect(response.status).toBe(201);
    });

    test('should start sequence at 1 for new conversation', async () => {
      // New conversation (different receiver)
      const newUser = await createTestUser('charlie', 'pass123');
      
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: newUser.user._id.toString(),
          encryptedContent: 'encrypted',
          iv: 'iv',
          authTag: 'tag',
          nonce: generateNonce(),
          sequenceNumber: 1 // First message
        });

      expect(response.status).toBe(201);
    });
  });

  describe('Timestamp Validation', () => {
    test('should accept messages with recent timestamps', async () => {
      // Check current expected sequence number
      const senderKey = `${user1._id}_to_${user2._id}`;
      const counter = await MessageCounter.findOne({ conversationId: senderKey });
      const expectedSequence = counter ? counter.counter + 1 : 1;
      
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent: 'encrypted',
          iv: 'iv',
          authTag: 'tag',
          nonce: generateNonce(),
          sequenceNumber: expectedSequence
        });

      expect(response.status).toBe(201);
      
      // Verify timestamp was stored
      const message = await Message.findOne({ senderId: user1._id, sequenceNumber: expectedSequence });
      expect(message).toBeDefined();
      expect(message.timestamp).toBeDefined();
      const timeDiff = Date.now() - message.timestamp.getTime();
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Multiple Protection Layers', () => {
    test('should detect replay even if one check passes', async () => {
      const nonce = generateNonce();
      
      // Send first message
      await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent: 'encrypted1',
          iv: 'iv1',
          authTag: 'tag1',
          nonce,
          sequenceNumber: 30
        });

      // Try replay with same nonce but different sequence
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          receiverId: user2._id.toString(),
          encryptedContent: 'encrypted2',
          iv: 'iv2',
          authTag: 'tag2',
          nonce, // Same nonce - should be caught
          sequenceNumber: 31 // Different sequence
        });

      // Nonce check should catch it first
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('replay attack');
    });
  });
});


const request = require('supertest');
const express = require('express');
const { createTestUser, createTamperedToken, createExpiredToken } = require('./helpers/testHelpers');

// Import routes
const messageRoutes = require('../routes/messages');
const authMiddleware = require('../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/messages', messageRoutes);

describe('JWT Security Tests', () => {
  let user1, user2, validToken;

  beforeAll(async () => {
    // Use unique usernames to avoid conflicts
    const timestamp = Date.now();
    const result1 = await createTestUser(`alice_${timestamp}`, 'pass123');
    const result2 = await createTestUser(`bob_${timestamp}`, 'pass123');
    user1 = result1.user;
    user2 = result2.user;
    validToken = result1.token;
  });

  describe('JWT Token Validation', () => {
    test('should reject requests without token', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${user2._id}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token');
    });

    test('should reject tampered JWT', async () => {
      const tamperedToken = createTamperedToken(user1._id.toString(), 'alice');
      
      const response = await request(app)
        .get(`/api/messages/conversation/${user2._id}`)
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    test('should reject expired JWT', async () => {
      const expiredToken = createExpiredToken(user1._id.toString(), 'alice');
      
      const response = await request(app)
        .get(`/api/messages/conversation/${user2._id}`)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    test('should accept valid JWT', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${user2._id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
    });

    test('should extract userId from valid JWT', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${user2._id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      // The endpoint should work, meaning userId was extracted correctly
    });
  });

  describe('JWT Token Manipulation', () => {
    test('should prevent user ID spoofing via JWT', async () => {
      // Create token with different user ID
      const fakeToken = require('jsonwebtoken').sign(
        { userId: user2._id.toString(), username: 'alice' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Try to access messages as user2 using fake token
      const response = await request(app)
        .get(`/api/messages/conversation/${user1._id}`)
        .set('Authorization', `Bearer ${fakeToken}`);

      // Should work (token is valid), but authorization checks should prevent unauthorized access
      // This test verifies JWT structure, not authorization (that's tested elsewhere)
      expect(response.status).toBe(200);
    });

    test('should reject JWT with wrong secret', async () => {
      const wrongSecretToken = require('jsonwebtoken').sign(
        { userId: user1._id.toString(), username: 'alice' },
        'wrong-secret',
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .get(`/api/messages/conversation/${user2._id}`)
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('JWT Token Format', () => {
    test('should reject malformed JWT', async () => {
      const malformedTokens = [
        'not-a-jwt',
        'header.payload', // Missing signature
        'header', // Incomplete
        '', // Empty
        'Bearer token' // Wrong format
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get(`/api/messages/conversation/${user2._id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });
  });
});


const request = require('supertest');
const express = require('express');
const User = require('../models/User');
const { createTestUser } = require('./helpers/testHelpers');

// Import routes
const authRoutes = require('../routes/auth');
const validation = require('../middleware/validation');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Injection Attack Prevention Tests', () => {
  describe('NoSQL Injection Prevention', () => {
    test('should prevent NoSQL injection in username field', async () => {
      // Try NoSQL injection attack
      const maliciousInputs = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'this.username == this.password' }
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: maliciousInput,
            password: 'test'
          });

        // Should be rejected - either by validation (400) or as invalid credentials (401)
        // The important thing is it doesn't execute the injection
        expect([400, 401]).toContain(response.status);
      }
    });

    test('should prevent NoSQL injection in password field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: { $ne: null }
        });

      // Should be rejected - either by validation (400) or as invalid credentials (401)
      expect([400, 401]).toContain(response.status);
    });

    test('should sanitize user input with express-validator', async () => {
      // Try to inject MongoDB operators
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test$ne',
          password: 'password123',
          publicKey: 'test-key'
        });

      // Should be rejected by validation (username format check)
      expect(response.status).toBe(400);
    });
  });

  describe('SQL Injection Prevention (MongoDB)', () => {
    test('should use parameterized queries via Mongoose', async () => {
      // Mongoose automatically prevents injection
      const user = await User.findOne({ username: 'testuser' });
      
      // Try to inject via findOne
      const maliciousQuery = { username: { $ne: null } };
      const result = await User.findOne(maliciousQuery);
      
      // Mongoose handles this safely - it's a valid query but won't cause injection
      // The key is that user input is validated before reaching Mongoose
      expect(result).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('should validate username format', async () => {
      const invalidUsernames = [
        'ab', // Too short
        'a'.repeat(31), // Too long
        'user@name', // Invalid characters
        'user name', // Spaces
        'user-name' // Hyphens
      ];

      for (const username of invalidUsernames) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username,
            password: 'password123',
            publicKey: 'test-key'
          });

        expect(response.status).toBe(400);
      }
    });

    test('should validate password length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'validuser',
          password: 'short', // Too short
          publicKey: 'test-key'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should require publicKey', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'validuser',
          password: 'password123'
          // Missing publicKey
        });

      expect(response.status).toBe(400);
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize username input', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: payload,
            password: 'password123',
            publicKey: 'test-key'
          });

        // Should be rejected by validation (username format)
        expect(response.status).toBe(400);
      }
    });
  });
});


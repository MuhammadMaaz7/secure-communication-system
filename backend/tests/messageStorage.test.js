const Message = require('../models/Message');
const User = require('../models/User');
const { createTestUser, generateNonce } = require('./helpers/testHelpers');

describe('Message Storage Security Tests', () => {
  let user1, user2;

  beforeAll(async () => {
    // Use unique usernames to avoid conflicts
    const timestamp = Date.now();
    const result1 = await createTestUser(`sender_${timestamp}`, 'pass123');
    const result2 = await createTestUser(`receiver_${timestamp}`, 'pass123');
    user1 = result1.user;
    user2 = result2.user;
  });

  describe('Message Encryption', () => {
    test('should never store plaintext messages', async () => {
      const plaintext = 'Hello World - This is a secret message';
      const encryptedContent = 'aGVsbG8gd29ybGQgdGhpcyBpcyBhIHNlY3JldCBtZXNzYWdlIGVuY3J5cHRlZCB3aXRoIGFlcy0yNTYtZ2NtIGFuZCB0aGlzIGlzIGp1c3QgYSB0ZXN0IGVuY3J5cHRlZCBzdHJpbmcgdGhhdCBsb29rcyBsaWtlIGVuY3J5cHRlZCBkYXRh';
      
      const message = new Message({
        senderId: user1._id,
        receiverId: user2._id,
        encryptedContent: encryptedContent, // Encrypted, not plaintext
        iv: 'test-iv-base64',
        authTag: 'test-auth-tag-base64',
        nonce: generateNonce(),
        sequenceNumber: 1,
        timestamp: new Date()
      });

      await message.save();

      const savedMessage = await Message.findOne({ senderId: user1._id });
      
      expect(savedMessage.encryptedContent).toBeDefined();
      expect(savedMessage.encryptedContent).not.toBe(plaintext);
      expect(savedMessage.encryptedContent.length).toBeGreaterThan(50); // Encrypted data is longer
      expect(savedMessage.encryptedContent).toBe(encryptedContent);
    });

    test('should store IV and authTag separately', async () => {
      const message = new Message({
        senderId: user1._id,
        receiverId: user2._id,
        encryptedContent: 'encrypted-content-base64',
        iv: 'initialization-vector-base64',
        authTag: 'authentication-tag-base64',
        nonce: generateNonce(),
        sequenceNumber: 2,
        timestamp: new Date()
      });

      await message.save();

      const savedMessage = await Message.findOne({ senderId: user1._id, sequenceNumber: 2 });
      
      expect(savedMessage.iv).toBeDefined();
      expect(savedMessage.iv).toBe('initialization-vector-base64');
      expect(savedMessage.authTag).toBeDefined();
      expect(savedMessage.authTag).toBe('authentication-tag-base64');
      expect(savedMessage.iv).not.toBe(savedMessage.authTag);
    });

    test('should not have plaintext field in schema', () => {
      const schema = Message.schema.paths;
      
      // Verify there's no 'content' or 'plaintext' field
      expect(schema.content).toBeUndefined();
      expect(schema.plaintext).toBeUndefined();
      
      // Verify only encrypted fields exist
      expect(schema.encryptedContent).toBeDefined();
      expect(schema.iv).toBeDefined();
      expect(schema.authTag).toBeDefined();
    });

    test('should store metadata without exposing message content', async () => {
      const message = new Message({
        senderId: user1._id,
        receiverId: user2._id,
        encryptedContent: 'very-long-encrypted-string-that-looks-like-ciphertext',
        iv: 'iv-data',
        authTag: 'tag-data',
        nonce: generateNonce(),
        sequenceNumber: 3,
        timestamp: new Date()
      });

      await message.save();

      const savedMessage = await Message.findOne({ senderId: user1._id, sequenceNumber: 3 });
      
      // Metadata should be accessible
      expect(savedMessage.senderId).toBeDefined();
      expect(savedMessage.receiverId).toBeDefined();
      expect(savedMessage.timestamp).toBeDefined();
      expect(savedMessage.sequenceNumber).toBe(3);
      
      // But content should be encrypted
      expect(savedMessage.encryptedContent).not.toContain('Hello');
      expect(savedMessage.encryptedContent).not.toContain('secret');
    });
  });

  describe('Message Schema Validation', () => {
    test('should require all encryption fields', async () => {
      const message = new Message({
        senderId: user1._id,
        receiverId: user2._id,
        // Missing encryptedContent, iv, authTag
        nonce: generateNonce(),
        sequenceNumber: 4
      });

      await expect(message.save()).rejects.toThrow();
    });

    test('should enforce nonce uniqueness', async () => {
      const nonce = generateNonce();
      
      const message1 = new Message({
        senderId: user1._id,
        receiverId: user2._id,
        encryptedContent: 'encrypted1',
        iv: 'iv1',
        authTag: 'tag1',
        nonce: nonce,
        sequenceNumber: 5,
        timestamp: new Date()
      });
      await message1.save();

      const message2 = new Message({
        senderId: user1._id,
        receiverId: user2._id,
        encryptedContent: 'encrypted2',
        iv: 'iv2',
        authTag: 'tag2',
        nonce: nonce, // Same nonce
        sequenceNumber: 6,
        timestamp: new Date()
      });

      // MongoDB unique index violations throw MongoServerError with code 11000
      // Verify it's a duplicate key error (MongoDB unique index violation)
      await expect(message2.save()).rejects.toThrow();
      
      // Verify the specific error type
      try {
        await message2.save();
        // Should not reach here - should throw error
        expect(true).toBe(false); // Force failure if save succeeds
      } catch (error) {
        // Should be a MongoDB duplicate key error
        expect(error.code).toBe(11000);
        expect(error.name).toBe('MongoServerError');
      }
    });
  });
});


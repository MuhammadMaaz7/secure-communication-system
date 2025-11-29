// Test helper functions
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

/**
 * Create a test user and return JWT token
 */
async function createTestUser(username = 'testuser', password = 'testpass123') {
  const publicKey = JSON.stringify({
    rsa: 'test-rsa-public-key',
    ecdsa: 'test-ecdsa-public-key'
  });
  
  const passwordHash = await User.hashPassword(password);
  const user = new User({
    username,
    passwordHash,
    publicKey
  });
  
  await user.save();
  
  const token = jwt.sign(
    { userId: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return { user, token };
}

/**
 * Create a test JWT token
 */
function createTestToken(userId, username) {
  return jwt.sign(
    { userId, username },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Create an expired JWT token
 */
function createExpiredToken(userId, username) {
  return jwt.sign(
    { userId, username },
    process.env.JWT_SECRET,
    { expiresIn: '-1h' } // Expired
  );
}

/**
 * Create a tampered JWT token (invalid signature)
 */
function createTamperedToken(userId, username) {
  const payload = { userId, username };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const fakeSignature = 'tampered-signature';
  return `${encodedHeader}.${encodedPayload}.${fakeSignature}`;
}

/**
 * Generate a random nonce
 */
function generateNonce() {
  return require('crypto').randomBytes(32).toString('base64');
}

/**
 * Generate a random session ID
 */
function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

module.exports = {
  createTestUser,
  createTestToken,
  createExpiredToken,
  createTamperedToken,
  generateNonce,
  generateSessionId
};


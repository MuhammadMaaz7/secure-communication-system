/**
 * Replay Attack Demonstration Script
 * 
 * This script demonstrates how replay attacks are prevented using:
 * 1. Nonces (unique identifiers)
 * 2. Timestamps (freshness)
 * 3. Sequence numbers (ordering)
 */

const crypto = require('crypto');

console.log('='.repeat(80));
console.log('REPLAY ATTACK DEMONSTRATION');
console.log('='.repeat(80));
console.log();

// ============================================================================
// SCENARIO 1: Replay Attack WITHOUT Protection (VULNERABLE)
// ============================================================================

console.log('SCENARIO 1: Message System WITHOUT Replay Protection');
console.log('-'.repeat(80));

// Simulate message database
const messagesDB = [];

// Alice sends a message
const message1 = {
  sender: 'alice',
  receiver: 'bob',
  encryptedContent: 'xK9mP2vL8qR3nF6jH4kL7mN9pQ2rS5tV8wX',
  iv: '7hG3kL9mN2pQ5rS8tV',
  authTag: '4fD8jK2nM5rT7wX9zA'
};

console.log('1. Alice sends message to Bob:');
console.log(`   Encrypted: ${message1.encryptedContent.substring(0, 20)}...`);
console.log();

// Server accepts and stores message
messagesDB.push({ ...message1, timestamp: new Date() });
console.log('2. Server accepts and stores message');
console.log(`   Messages in DB: ${messagesDB.length}`);
console.log();

// Attacker captures the message
console.log('3. ⚠️  ATTACKER CAPTURES THE MESSAGE');
const capturedMessage = { ...message1 };
console.log(`   Captured: ${capturedMessage.encryptedContent.substring(0, 20)}...`);
console.log();

// Wait a moment
console.log('4. Attacker waits 5 seconds...');
console.log();

// Attacker replays the EXACT same message
console.log('5. ⚠️  ATTACKER REPLAYS THE MESSAGE');
console.log('   Sending exact same message again...');
console.log();

// Server accepts it again (NO PROTECTION!)
messagesDB.push({ ...capturedMessage, timestamp: new Date() });
console.log('6. ✗ Server accepts the replayed message!');
console.log(`   Messages in DB: ${messagesDB.length}`);
console.log();

console.log('RESULT: REPLAY ATTACK SUCCESSFUL! 🔓');
console.log('-'.repeat(80));
console.log('✗ Same message accepted twice');
console.log('✗ Bob receives duplicate message');
console.log('✗ Could be used for:');
console.log('  - Duplicate transactions');
console.log('  - Spam attacks');
console.log('  - Denial of service');
console.log();
console.log('='.repeat(80));
console.log();
console.log();

// ============================================================================
// SCENARIO 2: Replay Attack WITH Protection (OUR PROTOCOL - SECURE)
// ============================================================================

console.log('SCENARIO 2: Message System WITH Replay Protection (OUR PROTOCOL)');
console.log('-'.repeat(80));

// Simulate protected message database
const protectedMessagesDB = [];
const seenNonces = new Set();
let sequenceCounter = 0;

// Helper function to generate nonce
function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to check message
function checkMessage(msg) {
  const errors = [];

  // Check 1: Nonce uniqueness
  if (seenNonces.has(msg.nonce)) {
    errors.push('DUPLICATE NONCE - replay detected');
  }

  // Check 2: Timestamp freshness
  const now = Date.now();
  const messageTime = msg.timestamp;
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (Math.abs(now - messageTime) > maxAge) {
    errors.push('STALE TIMESTAMP - message too old');
  }

  // Check 3: Sequence number
  if (msg.sequenceNumber !== sequenceCounter + 1) {
    errors.push(`INVALID SEQUENCE - expected ${sequenceCounter + 1}, got ${msg.sequenceNumber}`);
  }

  return errors;
}

console.log('Protection Mechanisms:');
console.log('  1. Nonces: Unique random identifier per message');
console.log('  2. Timestamps: Message must be fresh (< 5 minutes old)');
console.log('  3. Sequence Numbers: Messages must be in order');
console.log();

// Alice sends first message
const nonce1 = generateNonce();
const protectedMessage1 = {
  sender: 'alice',
  receiver: 'bob',
  encryptedContent: 'xK9mP2vL8qR3nF6jH4kL7mN9pQ2rS5tV8wX',
  iv: '7hG3kL9mN2pQ5rS8tV',
  authTag: '4fD8jK2nM5rT7wX9zA',
  nonce: nonce1,
  sequenceNumber: 1,
  timestamp: Date.now()
};

console.log('1. Alice sends message to Bob:');
console.log(`   Encrypted: ${protectedMessage1.encryptedContent.substring(0, 20)}...`);
console.log(`   Nonce: ${protectedMessage1.nonce.substring(0, 16)}...`);
console.log(`   Sequence: ${protectedMessage1.sequenceNumber}`);
console.log(`   Timestamp: ${new Date(protectedMessage1.timestamp).toISOString()}`);
console.log();

// Server validates message
console.log('2. Server validates message:');
const errors1 = checkMessage(protectedMessage1);

if (errors1.length === 0) {
  protectedMessagesDB.push(protectedMessage1);
  seenNonces.add(protectedMessage1.nonce);
  sequenceCounter = protectedMessage1.sequenceNumber;
  console.log('   ✓ Nonce is unique');
  console.log('   ✓ Timestamp is fresh');
  console.log('   ✓ Sequence number is correct');
  console.log('   ✓ Message accepted');
  console.log();
} else {
  console.log('   ✗ Message rejected:');
  errors1.forEach(err => console.log(`     - ${err}`));
  console.log();
}

// Attacker captures the message
console.log('3. ⚠️  ATTACKER CAPTURES THE MESSAGE');
const capturedProtectedMessage = { ...protectedMessage1 };
console.log(`   Captured nonce: ${capturedProtectedMessage.nonce.substring(0, 16)}...`);
console.log();

// Attacker waits
console.log('4. Attacker waits 2 seconds...');
console.log();

// ATTACK 1: Replay with same nonce
console.log('5. ⚠️  ATTACK 1: Attacker replays message with SAME NONCE');
console.log('   Sending exact same message...');
console.log();

console.log('6. Server validates replayed message:');
const replayErrors1 = checkMessage(capturedProtectedMessage);

if (replayErrors1.length > 0) {
  console.log('   ✗ Message REJECTED:');
  replayErrors1.forEach(err => console.log(`     - ${err}`));
  console.log('   ✓ REPLAY ATTACK PREVENTED!');
  console.log();
} else {
  console.log('   ✗ Message accepted (VULNERABLE!)');
  console.log();
}

// ATTACK 2: Replay with new nonce but old sequence
console.log('7. ⚠️  ATTACK 2: Attacker tries with NEW NONCE but OLD SEQUENCE');
const replayMessage2 = {
  ...capturedProtectedMessage,
  nonce: generateNonce(), // New nonce
  sequenceNumber: 1, // Old sequence number
};
console.log(`   New nonce: ${replayMessage2.nonce.substring(0, 16)}...`);
console.log(`   Sequence: ${replayMessage2.sequenceNumber} (should be ${sequenceCounter + 1})`);
console.log();

console.log('8. Server validates:');
const replayErrors2 = checkMessage(replayMessage2);

if (replayErrors2.length > 0) {
  console.log('   ✗ Message REJECTED:');
  replayErrors2.forEach(err => console.log(`     - ${err}`));
  console.log('   ✓ REPLAY ATTACK PREVENTED!');
  console.log();
} else {
  console.log('   ✗ Message accepted (VULNERABLE!)');
  console.log();
}

// ATTACK 3: Replay after 10 minutes (stale timestamp)
console.log('9. ⚠️  ATTACK 3: Attacker replays after 10 MINUTES');
const replayMessage3 = {
  ...capturedProtectedMessage,
  nonce: generateNonce(),
  sequenceNumber: sequenceCounter + 1,
  timestamp: Date.now() - (10 * 60 * 1000) // 10 minutes ago
};
console.log(`   Timestamp: ${new Date(replayMessage3.timestamp).toISOString()}`);
console.log(`   Age: 10 minutes (max allowed: 5 minutes)`);
console.log();

console.log('10. Server validates:');
const replayErrors3 = checkMessage(replayMessage3);

if (replayErrors3.length > 0) {
  console.log('   ✗ Message REJECTED:');
  replayErrors3.forEach(err => console.log(`     - ${err}`));
  console.log('   ✓ REPLAY ATTACK PREVENTED!');
  console.log();
} else {
  console.log('   ✗ Message accepted (VULNERABLE!)');
  console.log();
}

// Valid message for comparison
console.log('11. Alice sends VALID new message:');
const validMessage = {
  sender: 'alice',
  receiver: 'bob',
  encryptedContent: 'aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV',
  iv: '9xY8wV7uT6sR5qP4oN',
  authTag: '3mL2kJ1iH0gF9eD8cB',
  nonce: generateNonce(),
  sequenceNumber: sequenceCounter + 1,
  timestamp: Date.now()
};

console.log(`   Nonce: ${validMessage.nonce.substring(0, 16)}... (NEW)`);
console.log(`   Sequence: ${validMessage.sequenceNumber} (CORRECT)`);
console.log(`   Timestamp: ${new Date(validMessage.timestamp).toISOString()} (FRESH)`);
console.log();

console.log('12. Server validates:');
const validErrors = checkMessage(validMessage);

if (validErrors.length === 0) {
  protectedMessagesDB.push(validMessage);
  seenNonces.add(validMessage.nonce);
  sequenceCounter = validMessage.sequenceNumber;
  console.log('   ✓ All checks passed');
  console.log('   ✓ Message ACCEPTED');
  console.log();
}

console.log('RESULT: ALL REPLAY ATTACKS PREVENTED! 🔒');
console.log('-'.repeat(80));
console.log(`Messages in DB: ${protectedMessagesDB.length} (only valid messages)`);
console.log(`Nonces tracked: ${seenNonces.size}`);
console.log(`Current sequence: ${sequenceCounter}`);
console.log();

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();
console.log('WITHOUT PROTECTION:');
console.log('  ✗ Same message can be sent multiple times');
console.log('  ✗ No way to detect replays');
console.log('  ✗ Vulnerable to replay attacks');
console.log();
console.log('WITH TRIPLE PROTECTION (Our Protocol):');
console.log('  ✓ Nonces prevent duplicate messages');
console.log('  ✓ Timestamps prevent old message replay');
console.log('  ✓ Sequence numbers prevent out-of-order replay');
console.log('  ✓ All three mechanisms work together');
console.log('  ✓ Replay attacks detected and prevented');
console.log();
console.log('Defense Layers:');
console.log('  1. NONCE: Unique per message, checked against database');
console.log('  2. TIMESTAMP: Must be within 5-minute window');
console.log('  3. SEQUENCE: Must be next expected number');
console.log();
console.log('Even if attacker bypasses one layer, others catch the attack!');
console.log('='.repeat(80));

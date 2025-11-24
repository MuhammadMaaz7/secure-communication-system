/**
 * MITM Attack Demonstration Script
 * 
 * This script demonstrates:
 * 1. How MITM attack succeeds against plain DH (without signatures)
 * 2. How MITM attack fails against our protocol (with signatures)
 */

const crypto = require('crypto');

console.log('='.repeat(80));
console.log('MITM ATTACK DEMONSTRATION');
console.log('='.repeat(80));
console.log();

// ============================================================================
// SCENARIO 1: Plain Diffie-Hellman WITHOUT Signatures (VULNERABLE)
// ============================================================================

console.log('SCENARIO 1: Plain DH Key Exchange (NO SIGNATURES)');
console.log('-'.repeat(80));

// Alice generates DH key pair
const aliceDH = crypto.createECDH('prime256v1');
aliceDH.generateKeys();
const alicePublicKey = aliceDH.getPublicKey();

console.log('1. Alice generates DH key pair');
console.log(`   Alice's public key: ${alicePublicKey.toString('hex').substring(0, 32)}...`);
console.log();

// Alice sends public key to Bob (but Attacker intercepts)
console.log('2. Alice → [ATTACKER] → Bob: Sending public key');
console.log('   ⚠️  ATTACKER INTERCEPTS!');
console.log();

// Attacker generates their own DH key pair
const attackerDH = crypto.createECDH('prime256v1');
attackerDH.generateKeys();
const attackerPublicKey = attackerDH.getPublicKey();

console.log('3. Attacker generates their own DH key pair');
console.log(`   Attacker's public key: ${attackerPublicKey.toString('hex').substring(0, 32)}...`);
console.log();

// Attacker forwards THEIR public key to Bob (not Alice's)
console.log('4. [ATTACKER] → Bob: Forwarding ATTACKER\'S public key (not Alice\'s)');
console.log('   ⚠️  Bob thinks this is Alice\'s key!');
console.log();

// Bob generates DH key pair
const bobDH = crypto.createECDH('prime256v1');
bobDH.generateKeys();
const bobPublicKey = bobDH.getPublicKey();

console.log('5. Bob generates DH key pair');
console.log(`   Bob's public key: ${bobPublicKey.toString('hex').substring(0, 32)}...`);
console.log();

// Bob sends his public key back (Attacker intercepts again)
console.log('6. Bob → [ATTACKER] → Alice: Sending public key');
console.log('   ⚠️  ATTACKER INTERCEPTS AGAIN!');
console.log();

// Attacker computes shared secret with Bob
const attackerBobSecret = attackerDH.computeSecret(bobPublicKey);
console.log('7. Attacker computes shared secret with Bob');
console.log(`   Attacker-Bob secret: ${attackerBobSecret.toString('hex').substring(0, 32)}...`);
console.log();

// Attacker forwards THEIR public key to Alice (not Bob's)
console.log('8. [ATTACKER] → Alice: Forwarding ATTACKER\'S public key (not Bob\'s)');
console.log('   ⚠️  Alice thinks this is Bob\'s key!');
console.log();

// Alice computes shared secret with Attacker (thinking it's Bob)
const aliceAttackerSecret = aliceDH.computeSecret(attackerPublicKey);
console.log('9. Alice computes shared secret (with Attacker, not Bob!)');
console.log(`   Alice-Attacker secret: ${aliceAttackerSecret.toString('hex').substring(0, 32)}...`);
console.log();

// Result: Attacker has two shared secrets
console.log('RESULT: MITM ATTACK SUCCESSFUL! 🔓');
console.log('-'.repeat(80));
console.log('Attacker now has TWO shared secrets:');
console.log(`  - With Alice: ${aliceAttackerSecret.toString('hex').substring(0, 32)}...`);
console.log(`  - With Bob:   ${attackerBobSecret.toString('hex').substring(0, 32)}...`);
console.log();
console.log('Attacker can now:');
console.log('  ✓ Decrypt messages from Alice (using Alice-Attacker secret)');
console.log('  ✓ Decrypt messages from Bob (using Attacker-Bob secret)');
console.log('  ✓ Read, modify, and re-encrypt all messages');
console.log('  ✓ Alice and Bob have NO IDEA they are compromised!');
console.log();

// Demonstrate message interception
console.log('DEMONSTRATION: Message Interception');
console.log('-'.repeat(40));

// Alice encrypts message
const aliceMessage = 'Secret password: 12345';
const aliceKey = crypto.createHash('sha256').update(aliceAttackerSecret).digest();
const aliceIV = crypto.randomBytes(12);
const aliceCipher = crypto.createCipheriv('aes-256-gcm', aliceKey, aliceIV);
let aliceEncrypted = aliceCipher.update(aliceMessage, 'utf8', 'hex');
aliceEncrypted += aliceCipher.final('hex');
const aliceAuthTag = aliceCipher.getAuthTag();

console.log(`Alice sends: "${aliceMessage}"`);
console.log(`Encrypted: ${aliceEncrypted.substring(0, 32)}...`);
console.log();

// Attacker intercepts and decrypts
const attackerDecipher = crypto.createDecipheriv('aes-256-gcm', aliceKey, aliceIV);
attackerDecipher.setAuthTag(aliceAuthTag);
let attackerDecrypted = attackerDecipher.update(aliceEncrypted, 'hex', 'utf8');
attackerDecrypted += attackerDecipher.final('utf8');

console.log('⚠️  ATTACKER INTERCEPTS AND DECRYPTS:');
console.log(`Decrypted: "${attackerDecrypted}"`);
console.log('✓ Attacker can read the message!');
console.log();

console.log('='.repeat(80));
console.log();
console.log();

// ============================================================================
// SCENARIO 2: DH with Digital Signatures (OUR PROTOCOL - SECURE)
// ============================================================================

console.log('SCENARIO 2: DH Key Exchange WITH SIGNATURES (OUR PROTOCOL)');
console.log('-'.repeat(80));

// Alice generates DH key pair and signing key
const aliceDH2 = crypto.createECDH('prime256v1');
aliceDH2.generateKeys();
const alicePublicKey2 = aliceDH2.getPublicKey();

const aliceSigningKey = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

console.log('1. Alice generates DH key pair and signing key');
console.log(`   Alice's DH public key: ${alicePublicKey2.toString('hex').substring(0, 32)}...`);
console.log();

// Alice signs her public key
const aliceDataToSign = Buffer.concat([
  alicePublicKey2,
  Buffer.from(Date.now().toString()),
  Buffer.from('bob_id')
]);
const aliceSignature = crypto.sign('sha256', aliceDataToSign, aliceSigningKey.privateKey);

console.log('2. Alice signs her public key with her private signing key');
console.log(`   Signature: ${aliceSignature.toString('hex').substring(0, 32)}...`);
console.log();

// Alice sends: public key + signature
console.log('3. Alice → [ATTACKER] → Bob: Sending {public_key, signature}');
console.log('   ⚠️  ATTACKER INTERCEPTS!');
console.log();

// Attacker tries to substitute their own public key
const attackerDH2 = crypto.createECDH('prime256v1');
attackerDH2.generateKeys();
const attackerPublicKey2 = attackerDH2.getPublicKey();

console.log('4. Attacker attempts to substitute their own public key');
console.log(`   Attacker's public key: ${attackerPublicKey2.toString('hex').substring(0, 32)}...`);
console.log();

// Attacker forwards: attacker's public key + Alice's signature (invalid!)
console.log('5. [ATTACKER] → Bob: Forwarding {ATTACKER_public_key, Alice_signature}');
console.log('   ⚠️  Signature doesn\'t match the public key!');
console.log();

// Bob receives and verifies signature
console.log('6. Bob verifies signature against Alice\'s registered public key');

// Bob has Alice's public signing key (from server registration)
const alicePublicSigningKey = aliceSigningKey.publicKey;

// Bob tries to verify the signature
const attackerDataToVerify = Buffer.concat([
  attackerPublicKey2,  // Attacker's key (not Alice's!)
  Buffer.from(Date.now().toString()),
  Buffer.from('bob_id')
]);

let signatureValid = false;
try {
  signatureValid = crypto.verify(
    'sha256',
    attackerDataToVerify,
    alicePublicSigningKey,
    aliceSignature
  );
} catch (error) {
  signatureValid = false;
}

console.log(`   Signature verification: ${signatureValid ? 'VALID ✓' : 'INVALID ✗'}`);
console.log();

if (!signatureValid) {
  console.log('RESULT: MITM ATTACK PREVENTED! 🔒');
  console.log('-'.repeat(80));
  console.log('✗ Signature verification FAILED');
  console.log('✗ Bob detects that the public key was tampered with');
  console.log('✗ Bob REJECTS the key exchange');
  console.log('✗ Connection REFUSED');
  console.log('✗ Attacker CANNOT decrypt messages');
  console.log();
  console.log('Why the attack failed:');
  console.log('  1. Alice signed her public key with her private signing key');
  console.log('  2. Attacker cannot forge Alice\'s signature (no private key)');
  console.log('  3. Bob verifies signature against Alice\'s registered public key');
  console.log('  4. Modified public key causes signature verification to fail');
  console.log('  5. Attack detected and prevented!');
  console.log();
}

// Now show successful exchange with valid signatures
console.log('DEMONSTRATION: Successful Exchange (No Attacker)');
console.log('-'.repeat(40));

// Bob generates his keys
const bobDH2 = crypto.createECDH('prime256v1');
bobDH2.generateKeys();
const bobPublicKey2 = bobDH2.getPublicKey();

const bobSigningKey = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

console.log('1. Bob generates DH key pair and signing key');
console.log();

// Bob signs his public key
const bobDataToSign = Buffer.concat([
  bobPublicKey2,
  Buffer.from(Date.now().toString()),
  Buffer.from('session_id')
]);
const bobSignature = crypto.sign('sha256', bobDataToSign, bobSigningKey.privateKey);

console.log('2. Bob signs his public key');
console.log();

// Alice verifies Bob's signature (direct communication, no attacker)
const bobDataToVerify = Buffer.concat([
  bobPublicKey2,
  Buffer.from(Date.now().toString()),
  Buffer.from('session_id')
]);

const bobSignatureValid = crypto.verify(
  'sha256',
  bobDataToVerify,
  bobSigningKey.publicKey,
  bobSignature
);

console.log(`3. Alice verifies Bob's signature: ${bobSignatureValid ? 'VALID ✓' : 'INVALID ✗'}`);
console.log();

if (bobSignatureValid) {
  // Both compute shared secret
  const aliceBobSecret = aliceDH2.computeSecret(bobPublicKey2);
  const bobAliceSecret = bobDH2.computeSecret(alicePublicKey2);

  console.log('4. Both parties compute shared secret');
  console.log(`   Alice's computed secret: ${aliceBobSecret.toString('hex').substring(0, 32)}...`);
  console.log(`   Bob's computed secret:   ${bobAliceSecret.toString('hex').substring(0, 32)}...`);
  console.log();

  const secretsMatch = aliceBobSecret.equals(bobAliceSecret);
  console.log(`5. Secrets match: ${secretsMatch ? 'YES ✓' : 'NO ✗'}`);
  console.log();

  if (secretsMatch) {
    console.log('RESULT: SECURE KEY EXCHANGE SUCCESSFUL! 🔒');
    console.log('-'.repeat(80));
    console.log('✓ Signatures verified');
    console.log('✓ Shared secret established');
    console.log('✓ No MITM possible');
    console.log('✓ Secure communication channel established');
  }
}

console.log();
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();
console.log('WITHOUT SIGNATURES (Plain DH):');
console.log('  ✗ Vulnerable to MITM attacks');
console.log('  ✗ Attacker can intercept and decrypt all messages');
console.log('  ✗ No way to detect the attack');
console.log();
console.log('WITH SIGNATURES (Our Protocol):');
console.log('  ✓ Protected against MITM attacks');
console.log('  ✓ Signature verification detects tampering');
console.log('  ✓ Attacker cannot forge signatures');
console.log('  ✓ Attack detected and connection refused');
console.log();
console.log('='.repeat(80));

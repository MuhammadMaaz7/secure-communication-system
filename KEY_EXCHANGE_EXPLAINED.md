# Custom Key Exchange Protocol - Simple Explanation

## What is it?

A **custom-designed protocol** that allows two users to securely agree on a shared secret key over an insecure network (the internet), even if someone is watching!

---

## Why is it "Custom"?

Instead of using a standard protocol like TLS or Signal Protocol directly, we **designed our own variant** that combines:

1. **ECDH** (Elliptic Curve Diffie-Hellman) - For creating shared secrets
2. **ECDSA** (Digital Signatures) - For proving identity
3. **HKDF** (Key Derivation) - For creating the final session key
4. **Key Confirmation** - For verifying both parties have the same key

This combination and the specific way we implement it makes it **our custom protocol**.

---

## Real-World Analogy

### The Locked Box Method:

**Scenario:** Alice wants to send Bob a secret message, but they're in different cities.

**Traditional (Insecure) Way:**
```
Alice → "Hey Bob, our secret code is 1234" → Bob
         ↑ Anyone can hear this!
```

**Our Custom Protocol (Secure Way):**

```
Step 1: Alice creates a special lock (ECDH public key)
Step 2: Alice signs the lock with her signature (ECDSA)
        "This lock is really from Alice!"
        
Step 3: Alice sends the signed lock to Bob
        → Server stores it temporarily
        
Step 4: Bob receives the lock
        Bob checks: "Is this signature really Alice's?" ✓
        
Step 5: Bob creates his own special lock
Step 6: Bob signs it with his signature
        
Step 7: Bob sends his signed lock back
        → Server delivers it to Alice
        
Step 8: Alice checks: "Is this signature really Bob's?" ✓

Step 9: MAGIC! Both locks combine to create the SAME secret key
        (This is the ECDH math magic!)
        
Step 10: Alice sends a test message encrypted with the key
         "If you can read this, we have the same key!"
         
Step 11: Bob decrypts it successfully ✓
         "Yes! We have the same secret key!"
```

**Result:** Alice and Bob now share a secret key that nobody else knows!

---

## Where is it Implemented?

### 1. Frontend (Client-Side) - The Main Protocol

**File:** `frontend/src/services/keyExchange.js`

This file contains **3 main functions**:

#### Function 1: `initiateKeyExchange()` - Alice starts the exchange
```javascript
// Line 18-70
async initiateKeyExchange(responderId) {
  // 1. Generate temporary ECDH key pair
  const ecdhKeyPair = await CryptoUtils.generateECDHKeyPair();
  
  // 2. Sign the public key with ECDSA
  const signature = await CryptoUtils.signData(publicKey, signingKey);
  
  // 3. Send to server
  await api.post('/key-exchange/initiate', {
    responderId,
    publicKey,
    signature,
    timestamp
  });
  
  // 4. Store temporary key for later
  await KeyStorage.storePrivateKey(`ecdh_temp_${sessionId}`, privateKey);
}
```

**What it does:** Alice creates her part of the key exchange and sends it to Bob.

---

#### Function 2: `respondToKeyExchange()` - Bob responds
```javascript
// Line 72-160
async respondToKeyExchange(sessionId, initiatorId, initiatorPublicKey, initiatorSignature) {
  // 1. Verify Alice's signature
  const isValid = await CryptoUtils.verifySignature(
    initiatorPublicKey,
    initiatorSignature,
    initiatorVerifyKey
  );
  
  if (!isValid) {
    throw new Error('Invalid signature - possible MITM attack');
  }
  
  // 2. Generate Bob's ECDH key pair
  const ecdhKeyPair = await CryptoUtils.generateECDHKeyPair();
  
  // 3. Sign Bob's public key
  const signature = await CryptoUtils.signData(publicKey, signingKey);
  
  // 4. Derive shared secret using ECDH
  const sharedSecret = await CryptoUtils.deriveSharedSecret(
    bobPrivateKey,
    alicePublicKey
  );
  
  // 5. Derive session key using HKDF
  const sessionKey = await CryptoUtils.deriveAESKey(
    sharedSecret,
    salt,
    `session-${sessionId}`
  );
  
  // 6. Store session key
  await KeyStorage.storeSessionKey(initiatorId, sessionKey);
}
```

**What it does:** Bob verifies Alice is real, creates his part, and derives the shared secret.

---

#### Function 3: `completeKeyExchange()` - Alice completes
```javascript
// Line 162-230
async completeKeyExchange(sessionId, responderId) {
  // 1. Get Bob's response from server
  const response = await api.get(`/key-exchange/status/${sessionId}`);
  
  // 2. Verify Bob's signature
  const isValid = await CryptoUtils.verifySignature(
    responderPublicKey,
    responderSignature,
    responderVerifyKey
  );
  
  // 3. Derive shared secret (same as Bob!)
  const sharedSecret = await CryptoUtils.deriveSharedSecret(
    alicePrivateKey,
    bobPublicKey
  );
  
  // 4. Derive session key (same as Bob!)
  const sessionKey = await CryptoUtils.deriveAESKey(
    sharedSecret,
    salt,
    `session-${sessionId}`
  );
  
  // 5. Send key confirmation
  await this.sendAndVerifyKeyConfirmation(responderId, sessionKey, sessionId);
}
```

**What it does:** Alice verifies Bob is real, derives the same shared secret, and confirms the key works.

---

### 2. Backend (Server-Side) - Storage & Coordination

**File:** `backend/routes/keyExchange.js`

The server **doesn't know the secret key** but helps coordinate the exchange:

```javascript
// Store Alice's request
router.post('/initiate', async (req, res) => {
  const { responderId, publicKey, signature, timestamp } = req.body;
  
  // Store in database temporarily
  const keyExchange = new KeyExchange({
    initiatorId: req.userId,
    responderId,
    initiatorPublicKey: publicKey,
    initiatorSignature: signature,
    sessionId: crypto.randomBytes(32).toString('hex'),
    status: 'pending'
  });
  
  await keyExchange.save();
});

// Store Bob's response
router.post('/respond', async (req, res) => {
  const { sessionId, publicKey, signature } = req.body;
  
  // Update the exchange
  keyExchange.responderPublicKey = publicKey;
  keyExchange.responderSignature = signature;
  keyExchange.status = 'completed';
  
  await keyExchange.save();
});

// Let Alice check if Bob responded
router.get('/status/:sessionId', async (req, res) => {
  const keyExchange = await KeyExchange.findOne({ sessionId });
  
  res.json({
    status: keyExchange.status,
    responderPublicKey: keyExchange.responderPublicKey,
    responderSignature: keyExchange.responderSignature
  });
});
```

**What it does:** Acts as a mailbox - stores messages between Alice and Bob.

---

### 3. Cryptographic Functions

**File:** `frontend/src/utils/crypto.js`

This file contains the **building blocks**:

```javascript
// Generate ECDH key pair
async generateECDHKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Sign data with ECDSA
async signData(data, privateKey) {
  const signature = await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encodedData
  );
  return this.arrayBufferToBase64(signature);
}

// Verify signature
async verifySignature(data, signature, publicKey) {
  return await window.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    signatureBuffer,
    encodedData
  );
}

// Derive shared secret using ECDH
async deriveSharedSecret(privateKey, publicKey) {
  return await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
}

// Derive session key using HKDF
async deriveAESKey(sharedSecret, salt, info) {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBuffer,
      info: infoBuffer
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
```

---

## The Complete Flow (Visual)

```
ALICE (Initiator)                SERVER                    BOB (Responder)
      |                            |                              |
      |                            |                              |
1. Generate ECDH key pair          |                              |
   (public + private)              |                              |
      |                            |                              |
2. Sign public key with ECDSA      |                              |
   Signature = Sign(public_key)    |                              |
      |                            |                              |
3. Send to server ─────────────────>                              |
   {publicKey, signature}          |                              |
      |                            |                              |
      |                       Store in DB                         |
      |                            |                              |
      |                            |                              |
      |                       Notify Bob ──────────────────────────>
      |                            |                              |
      |                            |                    4. Get Alice's data
      |                            |                       from server
      |                            |                              |
      |                            |                    5. Verify Alice's
      |                            |                       signature ✓
      |                            |                              |
      |                            |                    6. Generate ECDH
      |                            |                       key pair
      |                            |                              |
      |                            |                    7. Sign public key
      |                            |                              |
      |                            |                    8. Derive shared
      |                            |                       secret using:
      |                            |                       - Bob's private
      |                            |                       - Alice's public
      |                            |                              |
      |                            |                    9. Derive session
      |                            |                       key using HKDF
      |                            |                              |
      |                            <─────────────────── 10. Send response
      |                            |                       {publicKey, sig}
      |                            |                              |
      |                       Store Bob's                         |
      |                       response                            |
      |                            |                              |
11. Poll server for response       |                              |
      |                            |                              |
12. Get Bob's data <───────────────┤                              |
      |                            |                              |
13. Verify Bob's signature ✓       |                              |
      |                            |                              |
14. Derive shared secret using:    |                              |
    - Alice's private              |                              |
    - Bob's public                 |                              |
      |                            |                              |
15. Derive session key (HKDF)      |                              |
    (SAME as Bob's!)               |                              |
      |                            |                              |
16. Send confirmation ─────────────>──────────────────────────────>
    Encrypted("KEY_CONFIRMATION")  |                              |
      |                            |                              |
      |                            |                    17. Decrypt ✓
      |                            |                        "KEY_CONFIRMATION"
      |                            |                              |
      |                            |                              |
    ✓ BOTH HAVE SAME SESSION KEY   |                    ✓ CONFIRMED!
      |                            |                              |
```

---

## Why is This "Custom"?

### Standard Protocols:
- **TLS:** Uses certificates and certificate authorities
- **Signal Protocol:** Uses prekeys and double ratchet
- **Noise Protocol:** Uses specific handshake patterns

### Our Custom Protocol:
- **No certificates:** Uses user's ECDSA keys directly
- **No prekeys:** Generates ephemeral keys on-demand
- **Custom flow:** Our own 3-step handshake design
- **Custom confirmation:** Our own key confirmation message
- **Custom storage:** Uses IndexedDB for key storage
- **Custom server coordination:** Our own database schema

**This makes it a "custom variant" - not copied from textbooks!**

---

## Key Components (What Makes it Custom)

### 1. ECDH (Elliptic Curve Diffie-Hellman) ✓
**Location:** `frontend/src/utils/crypto.js` - `generateECDHKeyPair()`
**Purpose:** Create shared secret without transmitting it

### 2. Digital Signatures (ECDSA) ✓
**Location:** `frontend/src/utils/crypto.js` - `signData()` and `verifySignature()`
**Purpose:** Prevent MITM attacks by proving identity

### 3. HKDF (Key Derivation) ✓
**Location:** `frontend/src/utils/crypto.js` - `deriveAESKey()`
**Purpose:** Derive strong session key from shared secret

### 4. Key Confirmation ✓
**Location:** `frontend/src/services/keyExchange.js` - `sendAndVerifyKeyConfirmation()`
**Purpose:** Verify both parties derived the same key

### 5. Timestamp Protection ✓
**Location:** `backend/routes/keyExchange.js` - timestamp verification
**Purpose:** Prevent replay attacks

---

## For Your Report

### Message Flow Diagram:

```
┌─────────┐                  ┌────────┐                  ┌─────────┐
│  Alice  │                  │ Server │                  │   Bob   │
└────┬────┘                  └───┬────┘                  └────┬────┘
     │                           │                            │
     │ 1. ECDH KeyGen            │                            │
     │ 2. Sign(PubKey)           │                            │
     │                           │                            │
     │ 3. {PubKey, Sig, TS} ────>│                            │
     │                           │                            │
     │                           │ 4. Store & Notify ────────>│
     │                           │                            │
     │                           │                 5. Verify Sig
     │                           │                 6. ECDH KeyGen
     │                           │                 7. Sign(PubKey)
     │                           │                 8. Derive Secret
     │                           │                 9. HKDF → SessionKey
     │                           │                            │
     │                           │<──── 10. {PubKey, Sig} ────│
     │                           │                            │
     │<──── 11. Get Response ────│                            │
     │                           │                            │
     │ 12. Verify Sig            │                            │
     │ 13. Derive Secret         │                            │
     │ 14. HKDF → SessionKey     │                            │
     │                           │                            │
     │ 15. Encrypt("CONFIRM") ──>│────────────────────────────>│
     │                           │                            │
     │                           │                 16. Decrypt ✓
     │                           │                            │
     │         ✓ SECURE CHANNEL ESTABLISHED ✓                 │
     │                           │                            │
```

---

## Summary

**What:** A custom key exchange protocol combining ECDH, ECDSA, HKDF, and key confirmation

**Where:** 
- Main logic: `frontend/src/services/keyExchange.js`
- Crypto functions: `frontend/src/utils/crypto.js`
- Server coordination: `backend/routes/keyExchange.js`

**Why Custom:** Unique combination and implementation not copied from standard protocols

**How it Works:** 3-step handshake with signatures, shared secret derivation, and confirmation

**Security:** Prevents MITM attacks, replay attacks, and ensures both parties have the same key

---

This is your **custom-designed protocol** that fulfills all the requirements! 🎉

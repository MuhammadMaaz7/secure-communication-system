# End-to-End Encrypted (E2EE) Chat Application

A secure, real-time chat application with end-to-end encryption, built with React, Node.js, and MongoDB. This project demonstrates advanced cryptographic protocols, secure key exchange, and comprehensive security measures.

---

## Security Features

- **End-to-End Encryption (E2EE)** - Messages encrypted client-side with AES-256-GCM
- **Custom Key Exchange Protocol** - ECDH + Digital Signatures for secure key establishment
- **Triple-Layer Replay Protection** - Nonces, timestamps, and sequence numbers
- **Device-Bound Keys** - Private keys never leave the device
- **MITM Attack Prevention** - Digital signatures verify authenticity
- **Comprehensive Security Logging** - All security events audited

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Application](#running-the-application)
5. [Using the Application](#using-the-application)
6. [Security Architecture](#security-architecture)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Project Structure](#project-structure)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v5 or higher) - [Download here](https://www.mongodb.com/try/download/community)
- **npm** or **yarn** - Comes with Node.js
- **Git** - [Download here](https://git-scm.com/)

### Check Your Installations:

```bash
node --version    # Should show v16.x.x or higher
npm --version     # Should show 8.x.x or higher
mongod --version  # Should show v5.x.x or higher
```

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/MuhammadMaaz7/secure-communication-system.git
cd secure-communication-system
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

**Packages installed:**
- express - Web framework
- mongoose - MongoDB ODM
- bcryptjs - Password hashing
- jsonwebtoken - JWT authentication
- socket.io - Real-time communication
- winston - Logging
- cors - Cross-origin resource sharing
- dotenv - Environment variables

### Step 3: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

**Packages installed:**
- react - UI framework
- vite - Build tool
- socket.io-client - WebSocket client
- axios - HTTP client

---

## Configuration

### Step 1: Set Up MongoDB

**Option A: Local MongoDB**

1. Start MongoDB service:
   ```bash
   # Windows
   net start MongoDB
   
   # macOS/Linux
   sudo systemctl start mongod
   ```

2. Verify MongoDB is running:
   ```bash
   mongosh
   # Should connect successfully
   ```

### Step 2: Configure Backend Environment

1. Navigate to backend folder:
   ```bash
   cd backend
   ```

2. Create `.env` file:
   ```bash
   # Windows
   copy .env.example .env
   
   # macOS/Linux
   cp .env.example .env
   ```

3. Edit `.env` file with your settings:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/e2ee_chat
   # OR for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/e2ee_chat
   
   # JWT Secret (generate a random string)
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:5173
   ```

**Important:** Change `JWT_SECRET` to a random, secure string in production!

### Step 3: Configure Frontend Environment

1. Navigate to frontend folder:
   ```bash
   cd ../frontend
   ```

2. Create `.env` file:
   ```bash
   # Windows
   copy .env.example .env
   
   # macOS/Linux
   cp .env.example .env
   ```

3. Edit `.env` file:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_SOCKET_URL=http://localhost:5000
   ```

---

## Running the Application

### Method 1: Run Both Servers Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

You should see:
```
Server running on port 5000
MongoDB connected successfully
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Verify Everything is Running:

1. **Backend:** Open http://localhost:5000 in browser
   - Should see: `{"message":"E2EE Chat API is running"}`

2. **Frontend:** Open http://localhost:5173 in browser
   - Should see the login/register page

3. **MongoDB:** Check connection in backend terminal
   - Should see: "MongoDB connected successfully"

---

## Using the Application

### First Time Setup

#### Step 1: Register Your First User

1. Open http://localhost:5173 in your browser
2. Click **"Register"** tab
3. Fill in the form:
   - **Username:** alice (3-30 characters)
   - **Password:** SecurePass123! (min 8 characters)
   - **Confirm Password:** SecurePass123!
4. Click **"Register"**

**What happens behind the scenes:**
- ✅ Password hashed with bcrypt (12 rounds)
- ✅ RSA-2048 key pair generated (for encryption)
- ✅ ECDSA P-256 key pair generated (for signatures)
- ✅ Private keys stored in IndexedDB (never sent to server)
- ✅ Public keys sent to server
- ✅ JWT token issued

#### Step 2: Register a Second User

1. **Open a new browser window** (or incognito/private window)
2. Go to http://localhost:5173
3. Register another user:
   - **Username:** bob
   - **Password:** SecurePass456!
4. Click **"Register"**

**Important:** Use a different browser window or incognito mode to simulate two different devices!

#### Step 3: Start Chatting

**In Alice's window:**
1. You'll see the chat interface
2. On the left sidebar, you'll see "bob" in the user list
3. Click on "bob"
4. Type a message: "Hello Bob!"
5. Click **"Send"**

**What happens behind the scenes:**
- ✅ Key exchange initiated (ECDH + signatures)
- ✅ Session key derived using HKDF
- ✅ Message encrypted with AES-256-GCM
- ✅ Nonce, sequence number, and timestamp added
- ✅ Encrypted message sent to server
- ✅ Bob receives notification via WebSocket

**In Bob's window:**
1. You'll see Alice's message appear
2. The message is automatically decrypted
3. Type a reply: "Hi Alice!"
4. Click **"Send"**

**Both users can now chat securely!**

---

## Security Architecture

### Cryptographic Protocols

#### 1. Key Generation (Registration)

```
User Registration
├── Generate RSA-2048 key pair (encryption)
├── Generate ECDSA P-256 key pair (signatures)
├── Store private keys in IndexedDB (client-side only)
└── Send public keys to server
```

#### 2. Key Exchange Protocol (First Message)

```
Initiator (Alice)                    Responder (Bob)
    │                                     │
    │  1. Generate ephemeral ECDH key     │
    │  2. Sign public key with ECDSA      │
    │  3. Send to server                  │
    ├──────────────────────────────────>  │
    │                                     │
    │                                     │  4. Verify signature
    │                                     │  5. Generate ECDH key
    │                                     │  6. Sign public key
    │                                     │  7. Derive shared secret
    │  <──────────────────────────────────┤
    │                                     │
    │  8. Verify signature                │
    │  9. Derive shared secret            │
    │ 10. Both derive session key (HKDF)  │
    │ 11. Send key confirmation           │
    └──────────────────────────────────>  │
```

#### 3. Message Encryption

```
Plaintext Message
    ↓
AES-256-GCM Encryption
    ├── Fresh random IV (12 bytes)
    ├── Authentication tag (16 bytes)
    └── Session key (derived from ECDH)
    ↓
Encrypted Message + Metadata
    ├── Ciphertext
    ├── IV
    ├── Auth tag
    ├── Nonce (replay protection)
    ├── Sequence number (replay protection)
    └── Timestamp (replay protection)
    ↓
Sent to Server (server cannot decrypt)
```

#### 4. Replay Attack Protection

**Three layers of protection:**

1. **Nonces:** Unique random value per message
   - Checked in-memory cache
   - Checked in database (unique constraint)
   - Duplicate = Replay attack detected

2. **Sequence Numbers:** Per-conversation counter
   - Each sender has own counter
   - Server enforces sequential order
   - Out-of-order = Replay attack detected

3. **Timestamps:** Message freshness check
   - 5-minute window enforced
   - Old timestamp = Replay attack detected

---

## Testing

### Manual Testing Scenarios

#### Test 1: Basic Chat Flow

1. Register two users (alice, bob)
2. Alice sends message to Bob
3. Bob receives and can read message
4. Bob replies to Alice
5. Both can see conversation history

**Expected:** All messages encrypt/decrypt correctly

#### Test 2: Multiple Users

1. Register three users (alice, bob, charlie)
2. Alice chats with Bob
3. Alice chats with Charlie
4. Bob chats with Charlie
5. Each conversation is independent

**Expected:** Each pair has separate session keys

#### Test 3: File Sharing

1. Alice clicks "Attach File"
2. Select a file (image, PDF, etc.)
3. Click "Upload"
4. Bob sees file notification
5. Bob clicks "Download"

**Expected:** File encrypted/decrypted correctly

#### Test 4: Device Isolation (E2EE Security)

1. Register alice on Browser 1
2. Try to login as alice on Browser 2
3. Should see error: "This account was registered on a different device"

**Expected:** Cannot access from different device (correct E2EE!)

#### Test 5: Logout and Re-login

1. Alice logs out
2. Alice logs back in (same browser)
3. Can see and decrypt old messages

**Expected:** Keys persist in IndexedDB

### Automated Testing

#### Run Backend Tests:
```bash
cd backend
npm test
```

#### Run Frontend Tests:
```bash
cd frontend
npm test
```

## Project Structure

```
e2ee-chat-app/
├── backend/                      # Node.js backend
│   ├── models/                   # MongoDB models
│   │   ├── User.js              # User schema
│   │   ├── Message.js           # Message schema
│   │   ├── File.js              # File schema
│   │   ├── KeyExchange.js       # Key exchange schema
│   │   └── MessageCounter.js    # Sequence counter schema
│   ├── routes/                   # API routes
│   │   ├── auth.js              # Authentication endpoints
│   │   ├── messages.js          # Message endpoints
│   │   ├── files.js             # File endpoints
│   │   ├── keyExchange.js       # Key exchange endpoints
│   │   └── users.js             # User endpoints
│   ├── middleware/               # Express middleware
│   │   ├── auth.js              # JWT authentication
│   │   └── validation.js        # Input validation
│   ├── utils/                    # Utility functions
│   │   └── logger.js            # Winston logger
│   ├── logs/                     # Log files
│   │   ├── combined.log         # All logs
│   │   └── error.log            # Error logs only
│   ├── .env                      # Environment variables
│   ├── index.js                  # Server entry point
│   ├── package.json              # Dependencies
│   
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── Login.jsx        # Login form
│   │   │   ├── Register.jsx     # Registration form
│   │   │   └── Chat.jsx         # Main chat interface
│   │   ├── contexts/            # React contexts
│   │   │   └── AuthContext.jsx  # Authentication state
│   │   ├── services/            # API services
│   │   │   ├── api.js           # Axios instance
│   │   │   ├── socketService.js # WebSocket client
│   │   │   ├── keyExchange.js   # Key exchange protocol
│   │   │   ├── messageService.js # Message encryption
│   │   │   └── fileService.js   # File encryption
│   │   ├── utils/               # Utility functions
│   │   │   ├── crypto.js        # Web Crypto API wrapper
│   │   │   └── keyStorage.js    # IndexedDB key storage
│   │   ├── App.jsx              # Root component
│   │   └── main.jsx             # Entry point
│   ├── .env                      # Environment variables
│   ├── package.json              # Dependencies
│   └── vite.config.js            # Vite configuration
│
└── README.md                     # This file
```

---

## Development Tips

### Adding New Features

1. **Backend API endpoint:**
   - Add route in `backend/routes/`
   - Add model in `backend/models/` if needed
   - Add logging with `logger.info()` or `logger.warn()`

2. **Frontend feature:**
   - Add component in `frontend/src/components/`
   - Add service in `frontend/src/services/`
   - Use `AuthContext` for user state


---

## License

This project is for educational purposes. See LICENSE file for details.

---

## Contributing

This is an academic project. For questions or issues, please contact the project team.

---

## Quick Start Checklist

- [ ] Node.js installed (v16+)
- [ ] MongoDB installed and running
- [ ] Backend dependencies installed (`npm install`)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Backend `.env` file configured
- [ ] Frontend `.env` file configured
- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] MongoDB connected successfully
- [ ] Can register a user
- [ ] Can send encrypted messages
- [ ] Can view security logs

---
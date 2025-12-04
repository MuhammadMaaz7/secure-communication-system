# End-to-End Encrypted (E2EE) Chat Application

A secure, real-time chat application with end-to-end encryption, built with React, Node.js, and MongoDB. This project demonstrates advanced cryptographic protocols, secure key exchange, and comprehensive security measures.

## 🔒 Security Features

- **End-to-End Encryption (E2EE)** - Messages encrypted client-side with AES-256-GCM
- **Custom Key Exchange Protocol** - ECDH + Digital Signatures for secure key establishment
- **Triple-Layer Replay Protection** - Nonces, timestamps, and sequence numbers
- **Device-Bound Keys** - Private keys never leave the device
- **MITM Attack Prevention** - Digital signatures verify authenticity
- **Real-time Communication** - WebSocket with Socket.IO
- **File Sharing** - Encrypted file upload/download
- **Two-Factor Authentication** - Email-based 2FA

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (local or Atlas)
- **npm** or **yarn**

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/MuhammadMaaz7/secure-communication-system.git
   cd secure-communication-system
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Configuration

1. **Backend Environment** (`backend/.env`)
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/e2ee_chat
   JWT_SECRET=your-super-secret-jwt-key-here
   ALLOWED_ORIGINS=http://localhost:5173
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

2. **Frontend Environment** (`frontend/.env`)
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

### Running the Application

1. **Start Backend** (Terminal 1)
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```

3. **Open Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## 🎯 Demo Instructions

### Testing the E2E Encryption

1. **Register First User**
   - Open http://localhost:5173
   - Register as "alice" with password "SecurePass123!"

2. **Register Second User**
   - Open **new browser window/incognito**
   - Register as "bob" with password "SecurePass456!"

3. **Start Secure Chat**
   - Alice clicks on "bob" in user list
   - Type message: "Hello Bob, this is encrypted!"
   - Bob receives and can decrypt the message
   - Bob replies: "Hi Alice, E2E encryption works!"

4. **Test File Sharing**
   - Click "Attach File" button
   - Upload any file (image, PDF, etc.)
   - File is encrypted and shared securely

### Key Features to Demonstrate

✅ **Device-Bound Security** - Cannot login from different browser  
✅ **Real-time Messaging** - Instant message delivery  
✅ **Message History** - Encrypted messages persist  
✅ **File Encryption** - Secure file sharing  
✅ **Online Status** - See who's online/offline  
✅ **Typing Indicators** - Real-time typing status  

## 🔐 Security Architecture

### Message Flow
```
Alice                    Server                    Bob
  │                        │                       │
  │ 1. Generate session key via ECDH exchange     │
  │ ←──────────────────────┼─────────────────────→ │
  │                        │                       │
  │ 2. Encrypt message     │                       │
  │ ──────────────────────→│                       │
  │                        │ 3. Store encrypted    │
  │                        │ ──────────────────────→│
  │                        │                       │
  │                        │              4. Decrypt│
```

### Key Exchange Protocol
1. **ECDH Key Generation** - Ephemeral key pairs
2. **Digital Signatures** - ECDSA authentication
3. **Shared Secret Derivation** - ECDH mathematics
4. **Session Key Derivation** - HKDF key stretching
5. **Key Confirmation** - Verify both parties have same key

### Encryption Details
- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits
- **IV**: 96 bits (random per message)
- **Authentication**: Built-in with GCM mode
- **Key Storage**: IndexedDB (client-side only)

## 📁 Project Structure

```
secure-communication-system/
├── backend/                 # Node.js API server
│   ├── models/             # MongoDB schemas
│   ├── routes/             # API endpoints
│   ├── middleware/         # Authentication & validation
│   ├── utils/              # Logging utilities
│   ├── config/             # Database configuration
│   └── index.js            # Server entry point
│
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── services/       # API & crypto services
│   │   ├── utils/          # Crypto & storage utilities
│   │   └── contexts/       # React contexts
│   └── dist/               # Built files
│
└── README.md               # This file
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🛠️ Development

### Adding New Features
1. **Backend**: Add routes in `backend/routes/`
2. **Frontend**: Add components in `frontend/src/components/`
3. **Database**: Add models in `backend/models/`

### Security Guidelines
- Never commit `.env` files
- All crypto operations client-side
- Validate all inputs
- Log security events

## 📝 Environment Variables

### Backend Required
- `MONGODB_URI` - Database connection
- `JWT_SECRET` - Token signing key
- `ALLOWED_ORIGINS` - CORS origins

### Frontend Required
- `VITE_API_URL` - Backend API URL
- `VITE_SOCKET_URL` - WebSocket URL

### Optional (2FA)
- `EMAIL_HOST` - SMTP server
- `EMAIL_USER` - Email username
- `EMAIL_PASS` - Email password

## 🎓 Educational Purpose

This project demonstrates:
- **Cryptographic Protocols** - Custom key exchange
- **Web Security** - CORS, CSRF, XSS prevention
- **Real-time Communication** - WebSocket implementation
- **Database Security** - Encrypted storage
- **Authentication** - JWT + 2FA
- **Frontend Security** - Secure key storage

## 📄 License

This project is for educational purposes. See LICENSE file for details.

---

**Ready for Demo!** 🚀

The application is now optimized for local development and demonstration. All E2E encryption features work perfectly for showcasing secure communication protocols.
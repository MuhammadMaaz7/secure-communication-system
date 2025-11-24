require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/database');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const keyExchangeRoutes = require('./routes/keyExchange');
const fileRoutes = require('./routes/files');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

connectDB();

app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/key-exchange', keyExchangeRoutes);
app.use('/api/files', fileRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const connectedUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.username} (${socket.userId})`);
  
  connectedUsers.set(socket.userId, socket.id);
  
  io.emit('user-status', {
    userId: socket.userId,
    username: socket.username,
    status: 'online'
  });

  socket.on('new-message', (data) => {
    const recipientSocketId = connectedUsers.get(data.receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message-received', {
        messageId: data.messageId,
        senderId: socket.userId,
        timestamp: data.timestamp
      });
    }
  });

  socket.on('key-exchange-request', async (data) => {
    const recipientSocketId = connectedUsers.get(data.responderId);
    if (recipientSocketId) {
      // Get the key exchange details from database
      const KeyExchange = require('./models/KeyExchange');
      const keyExchange = await KeyExchange.findOne({ sessionId: data.sessionId });
      
      if (keyExchange) {
        io.to(recipientSocketId).emit('key-exchange-notification', {
          sessionId: data.sessionId,
          initiatorId: socket.userId,
          initiatorUsername: socket.username,
          initiatorPublicKey: keyExchange.initiatorPublicKey,
          initiatorSignature: keyExchange.initiatorSignature
        });
      }
    }
  });

  socket.on('typing', (data) => {
    const recipientSocketId = connectedUsers.get(data.receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', {
        senderId: socket.userId,
        username: socket.username
      });
    }
  });

  socket.on('file-uploaded', (data) => {
    const recipientSocketId = connectedUsers.get(data.receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('file-notification', {
        senderId: socket.userId,
        fileId: data.fileId,
        fileName: data.fileName
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.username} (${socket.userId})`);
    connectedUsers.delete(socket.userId);
    
    io.emit('user-status', {
      userId: socket.userId,
      username: socket.username,
      status: 'offline'
    });
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  encryptedContent: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  authTag: {
    type: String,
    required: true
  },
  nonce: {
    type: String,
    required: true
  },
  sequenceNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  delivered: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

messageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
messageSchema.index({ nonce: 1 }, { unique: true });
messageSchema.index({ senderId: 1, receiverId: 1, sequenceNumber: 1 });

module.exports = mongoose.model('Message', messageSchema);

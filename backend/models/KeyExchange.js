const mongoose = require('mongoose');

const keyExchangeSchema = new mongoose.Schema({
  initiatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  initiatorPublicKey: {
    type: String,
    required: true
  },
  responderPublicKey: {
    type: String
  },
  initiatorSignature: {
    type: String,
    required: true
  },
  responderSignature: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  confirmationReceived: {
    type: Boolean,
    default: false
  },
  confirmationTimestamp: {
    type: Date
  }
}, {
  timestamps: true
});

keyExchangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('KeyExchange', keyExchangeSchema);

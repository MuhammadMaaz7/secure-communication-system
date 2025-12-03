const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  publicKey: {
    type: String,
    required: true
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorCode: {
    type: String,
    default: null
  },
  twoFactorCodeExpiry: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function(password) {
  return await bcrypt.hash(password, 12);
};

module.exports = mongoose.model('User', userSchema);

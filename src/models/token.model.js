const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [true, 'Token is required'],
    unique: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for temporary tokens, set for login tokens
  },
  type: {
    type: String,
    enum: ['temporary', 'login'],
    required: [true, 'Token type is required']
  },
  purpose: {
    type: String,
    enum: ['registration', 'forgot-password', 'login'],
    required: [true, 'Purpose is required']
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration time is required']
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for automatic cleanup
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient queries
tokenSchema.index({ token: 1, used: 1 });
tokenSchema.index({ email: 1, type: 1, used: 1 });

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token; 
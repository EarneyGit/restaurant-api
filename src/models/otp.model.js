const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    length: 6
  },
  purpose: {
    type: String,
    enum: ['registration', 'forgot-password'],
    required: [true, 'Purpose is required']
  },
  expiresAt: {
    type: Date,
    default: Date.now,
    expires: 600 // 10 minutes in seconds
  },
  used: {
    type: Boolean,
    default: false
  },
  // Audit Log Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for automatic cleanup
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient queries
otpSchema.index({ email: 1, otp: 1, used: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP; 
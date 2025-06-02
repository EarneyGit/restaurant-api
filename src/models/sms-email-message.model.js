const mongoose = require('mongoose');

const smsEmailMessageSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch ID is required']
  },
  type: {
    type: String,
    enum: ['email', 'sms'],
    required: [true, 'Message type is required']
  },
  target: {
    type: String,
    enum: ['ordered', 'reservation', 'all'],
    required: [true, 'Target audience is required']
  },
  template: {
    type: String,
    required: [true, 'Template is required'],
    default: 'standard'
  },
  subject: {
    type: String,
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters'],
    required: function() {
      return this.type === 'email';
    }
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  scheduledTime: {
    type: Date,
    default: null
  },
  sentTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['scheduled', 'sent', 'failed', 'cancelled'],
    default: function() {
      return this.scheduledTime ? 'scheduled' : 'sent';
    }
  },
  targetBranches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  }],
  overrideGdpr: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
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
  },
  metadata: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    successfulDeliveries: {
      type: Number,
      default: 0
    },
    failedDeliveries: {
      type: Number,
      default: 0
    },
    openCount: {
      type: Number,
      default: 0
    },
    clickCount: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
smsEmailMessageSchema.index({ branchId: 1, createdAt: -1 });
smsEmailMessageSchema.index({ status: 1, scheduledTime: 1 });
smsEmailMessageSchema.index({ branchId: 1, status: 1, type: 1 });
smsEmailMessageSchema.index({ targetBranches: 1 });

// Virtual for delivery rate
smsEmailMessageSchema.virtual('deliveryRate').get(function() {
  if (this.metadata.totalRecipients === 0) return 0;
  return (this.metadata.successfulDeliveries / this.metadata.totalRecipients * 100).toFixed(2);
});

// Pre-save middleware to set sentTime for immediate messages
smsEmailMessageSchema.pre('save', function(next) {
  if (this.isNew && !this.scheduledTime && this.status === 'sent') {
    this.sentTime = new Date();
  }
  next();
});

// Static method to get messages by branch
smsEmailMessageSchema.statics.getByBranch = function(branchId, options = {}) {
  const query = { 
    $or: [
      { branchId },
      { targetBranches: branchId }
    ],
    isActive: true 
  };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .populate('createdBy', 'name email')
    .populate('branchId', 'name')
    .populate('targetBranches', 'name')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Instance method to mark as sent
smsEmailMessageSchema.methods.markAsSent = function(metadata = {}) {
  this.status = 'sent';
  this.sentTime = new Date();
  if (metadata.totalRecipients) this.metadata.totalRecipients = metadata.totalRecipients;
  if (metadata.successfulDeliveries) this.metadata.successfulDeliveries = metadata.successfulDeliveries;
  if (metadata.failedDeliveries) this.metadata.failedDeliveries = metadata.failedDeliveries;
  return this.save();
};

// Instance method to mark as failed
smsEmailMessageSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.metadata.failureReason = reason;
  return this.save();
};

module.exports = mongoose.model('SmsEmailMessage', smsEmailMessageSchema); 
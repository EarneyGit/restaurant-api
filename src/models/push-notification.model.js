const mongoose = require('mongoose');

const pushNotificationSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch ID is required']
  },
  text: {
    type: String,
    required: [true, 'Notification text is required'],
    trim: true,
    maxlength: [500, 'Notification text cannot exceed 500 characters']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    default: 'New Notification'
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
  targetAudience: {
    type: String,
    enum: ['all', 'active_customers', 'new_customers', 'vip_customers'],
    default: 'all'
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
pushNotificationSchema.index({ branchId: 1, createdAt: -1 });
pushNotificationSchema.index({ status: 1, scheduledTime: 1 });
pushNotificationSchema.index({ branchId: 1, status: 1 });

// Virtual for delivery rate
pushNotificationSchema.virtual('deliveryRate').get(function() {
  if (this.metadata.totalRecipients === 0) return 0;
  return (this.metadata.successfulDeliveries / this.metadata.totalRecipients * 100).toFixed(2);
});

// Pre-save middleware to set sentTime for immediate notifications
pushNotificationSchema.pre('save', function(next) {
  if (this.isNew && !this.scheduledTime && this.status === 'sent') {
    this.sentTime = new Date();
  }
  next();
});

// Static method to get notifications by branch
pushNotificationSchema.statics.getByBranch = function(branchId, options = {}) {
  const query = { branchId, isActive: true };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('createdBy', 'name email')
    .populate('branchId', 'name')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Instance method to mark as sent
pushNotificationSchema.methods.markAsSent = function(metadata = {}) {
  this.status = 'sent';
  this.sentTime = new Date();
  if (metadata.totalRecipients) this.metadata.totalRecipients = metadata.totalRecipients;
  if (metadata.successfulDeliveries) this.metadata.successfulDeliveries = metadata.successfulDeliveries;
  if (metadata.failedDeliveries) this.metadata.failedDeliveries = metadata.failedDeliveries;
  return this.save();
};

// Instance method to mark as failed
pushNotificationSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.metadata.failureReason = reason;
  return this.save();
};

module.exports = mongoose.model('PushNotification', pushNotificationSchema); 
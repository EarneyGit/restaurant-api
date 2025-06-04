const mongoose = require('mongoose');

const repeatingPushNotificationSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch ID is required']
  },
  messageText: {
    type: String,
    required: [true, 'Message text is required'],
    trim: true,
    maxlength: [500, 'Message text cannot exceed 500 characters']
  },
  startRun: {
    type: Date,
    required: [true, 'Start run date is required']
  },
  endRun: {
    type: Date,
    required: [true, 'End run date is required']
  },
  lastRun: {
    type: Date,
    default: null
  },
  nextRun: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
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
  // Recurring configuration
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  interval: {
    type: Number,
    default: 1, // Every 1 day/week/month
    min: 1
  },
  // Execution tracking
  executionCount: {
    type: Number,
    default: 0
  },
  maxExecutions: {
    type: Number,
    default: null // null means unlimited
  },
  // Metadata for tracking
  metadata: {
    totalExecutions: {
      type: Number,
      default: 0
    },
    successfulExecutions: {
      type: Number,
      default: 0
    },
    failedExecutions: {
      type: Number,
      default: 0
    },
    lastExecutionStatus: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending'
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
repeatingPushNotificationSchema.index({ branchId: 1, createdAt: -1 });
repeatingPushNotificationSchema.index({ status: 1, nextRun: 1 });
repeatingPushNotificationSchema.index({ branchId: 1, status: 1 });
repeatingPushNotificationSchema.index({ nextRun: 1, status: 1 });

// Virtual for checking if notification is due
repeatingPushNotificationSchema.virtual('isDue').get(function() {
  if (!this.nextRun || this.status !== 'active') return false;
  return new Date() >= this.nextRun;
});

// Virtual for checking if notification is expired
repeatingPushNotificationSchema.virtual('isExpired').get(function() {
  return new Date() > this.endRun;
});

// Pre-save middleware to set nextRun if not set
repeatingPushNotificationSchema.pre('save', function(next) {
  if (this.isNew && !this.nextRun) {
    this.nextRun = this.startRun;
  }
  next();
});

// Static method to get notifications by branch
repeatingPushNotificationSchema.statics.getByBranch = function(branchId, options = {}) {
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

// Static method to get due notifications
repeatingPushNotificationSchema.statics.getDueNotifications = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    isActive: true,
    nextRun: { $lte: now },
    endRun: { $gte: now }
  })
    .populate('branchId', 'name')
    .populate('createdBy', 'name email');
};

// Instance method to calculate next run time
repeatingPushNotificationSchema.methods.calculateNextRun = function() {
  if (!this.nextRun) return null;
  
  const nextRun = new Date(this.nextRun);
  
  switch (this.frequency) {
    case 'daily':
      nextRun.setDate(nextRun.getDate() + this.interval);
      break;
    case 'weekly':
      nextRun.setDate(nextRun.getDate() + (7 * this.interval));
      break;
    case 'monthly':
      nextRun.setMonth(nextRun.getMonth() + this.interval);
      break;
  }
  
  // Don't schedule beyond end date
  if (nextRun > this.endRun) {
    return null;
  }
  
  return nextRun;
};

// Instance method to mark as executed
repeatingPushNotificationSchema.methods.markAsExecuted = function(success = true) {
  this.lastRun = new Date();
  this.executionCount += 1;
  this.metadata.totalExecutions += 1;
  
  if (success) {
    this.metadata.successfulExecutions += 1;
    this.metadata.lastExecutionStatus = 'success';
  } else {
    this.metadata.failedExecutions += 1;
    this.metadata.lastExecutionStatus = 'failed';
  }
  
  // Calculate next run
  const nextRun = this.calculateNextRun();
  if (nextRun) {
    this.nextRun = nextRun;
  } else {
    // No more runs, deactivate
    this.status = 'inactive';
    this.nextRun = null;
  }
  
  return this.save();
};

// Instance method to pause/resume
repeatingPushNotificationSchema.methods.toggleStatus = function() {
  this.status = this.status === 'active' ? 'inactive' : 'active';
  return this.save();
};

module.exports = mongoose.model('RepeatingPushNotification', repeatingPushNotificationSchema); 
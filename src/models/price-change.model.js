const mongoose = require('mongoose');

const priceChangeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['temporary', 'permanent', 'increase', 'decrease', 'fixed'],
    required: true
  },
  originalPrice: {
    type: Number,
    required: true
  },
  tempPrice: {
    type: Number
  },
  revertPrice: {
    type: Number
  },
  value: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  daysOfWeek: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  timeStart: {
    type: String
  },
  timeEnd: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  },
  autoRevert: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
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
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
priceChangeSchema.index({ productId: 1, active: 1 });
priceChangeSchema.index({ branchId: 1, startDate: 1 });
priceChangeSchema.index({ endDate: 1, autoRevert: 1 });
priceChangeSchema.index({ branchId: 1, type: 1, active: 1 });
priceChangeSchema.index({ id: 1 }, { unique: true });

// Compound index for current price changes queries
priceChangeSchema.index({ 
  branchId: 1, 
  active: 1, 
  startDate: 1, 
  endDate: 1 
});

module.exports = mongoose.model('PriceChange', priceChangeSchema); 
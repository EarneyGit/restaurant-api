const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    name: {
      type: String,
      required: [true, 'Discount name is required'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    code: {
      type: String,
      required: [true, 'Discount code is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Code cannot be more than 50 characters']
    },
    allowMultipleCoupons: {
      type: Boolean,
      default: false
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required']
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative']
    },
    minSpend: {
      type: Number,
      default: 0,
      min: [0, 'Minimum spend cannot be negative']
    },
    maxSpend: {
      type: Number,
      default: 0,
      min: [0, 'Maximum spend cannot be negative']
    },
    // Outlets availability - updated to support branch IDs
    outlets: {
      type: Map,
      of: Boolean,
      default: {}
    },
    // Keep legacy outlet format for backward compatibility
    legacyOutlets: {
      dunfermline: { type: Boolean, default: true },
      edinburgh: { type: Boolean, default: true },
      glasgow: { type: Boolean, default: true }
    },
    timeDependent: {
      type: Boolean,
      default: false
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    maxUses: {
      total: {
        type: Number,
        default: 0,
        min: [0, 'Total uses cannot be negative']
      },
      perCustomer: {
        type: Number,
        default: 0,
        min: [0, 'Per customer uses cannot be negative']
      },
      perDay: {
        type: Number,
        default: 0,
        min: [0, 'Per day uses cannot be negative']
      }
    },
    daysAvailable: {
      monday: { type: Boolean, default: true },
      tuesday: { type: Boolean, default: true },
      wednesday: { type: Boolean, default: true },
      thursday: { type: Boolean, default: true },
      friday: { type: Boolean, default: true },
      saturday: { type: Boolean, default: true },
      sunday: { type: Boolean, default: true }
    },
    serviceTypes: {
      collection: { type: Boolean, default: true },
      delivery: { type: Boolean, default: true },
      tableOrdering: { type: Boolean, default: true }
    },
    firstOrderOnly: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Usage tracking
    usageStats: {
      totalUsed: { type: Number, default: 0 },
      totalSavings: { type: Number, default: 0 },
      lastUsed: { type: Date, default: null }
    },
    // Created by admin user
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
discountSchema.index({ branchId: 1, code: 1 }, { unique: true });
discountSchema.index({ branchId: 1, isActive: 1 });
discountSchema.index({ code: 1 });
discountSchema.index({ startDate: 1, endDate: 1 });

// Virtual for checking if discount is currently valid
discountSchema.virtual('isCurrentlyValid').get(function() {
  if (!this.isActive) return false;
  
  if (this.timeDependent) {
    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;
  }
  
  return true;
});

// Method to check if discount is valid for a specific order
discountSchema.methods.isValidForOrder = function(order, user = null, checkBranchId = null) {
  // Check if discount is active and currently valid
  if (!this.isCurrentlyValid) {
    return { valid: false, reason: 'Discount is not currently active' };
  }
  
  // Check if discount is available for the branch (if a branch ID is provided)
  if (checkBranchId) {
    let isBranchEnabled = true;
    
    // Check new outlets format first (Map)
    if (this.outlets && this.outlets.size > 0) {
      // If we have specific branch entries, check if this branch is enabled
      if (this.outlets.has(checkBranchId)) {
        isBranchEnabled = this.outlets.get(checkBranchId);
      } else {
        // If the branch isn't in the list, default to false
        isBranchEnabled = false;
      }
    } else if (this.legacyOutlets) {
      // Fall back to legacy format if no new format data
      const branchNameMap = {
        // This should be replaced with actual logic to map branchId to name
        // For now, using dummy mapping for backward compatibility
      };
      
      const branchName = branchNameMap[checkBranchId];
      if (branchName && this.legacyOutlets[branchName] === false) {
        isBranchEnabled = false;
      }
    }
    
    if (!isBranchEnabled) {
      return { valid: false, reason: 'Discount not available at this branch' };
    }
  }
  
  // Check minimum spend
  if (order.totalAmount < this.minSpend) {
    return { valid: false, reason: `Minimum spend of £${this.minSpend.toFixed(2)} required` };
  }
  
  // Check maximum spend
  if (this.maxSpend > 0 && order.totalAmount > this.maxSpend) {
    return { valid: false, reason: `Maximum spend of £${this.maxSpend.toFixed(2)} exceeded` };
  }
  
  // Check day availability
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
  if (!this.daysAvailable[dayName]) {
    return { valid: false, reason: 'Discount not available today' };
  }
  
  // Check service type
  if (order.deliveryMethod) {
    const serviceTypeMap = {
      'pickup': 'collection',
      'delivery': 'delivery',
      'dine_in': 'tableOrdering'
    };
    const serviceType = serviceTypeMap[order.deliveryMethod];
    if (serviceType && !this.serviceTypes[serviceType]) {
      return { valid: false, reason: `Discount not available for ${order.deliveryMethod}` };
    }
  }
  
  // Check first order only (if user provided)
  if (this.firstOrderOnly && user) {
    // This would need to be checked against user's order history
    // For now, we'll assume it's valid
  }
  
  return { valid: true };
};

// Method to calculate discount amount
discountSchema.methods.calculateDiscount = function(orderTotal) {
  if (this.discountType === 'percentage') {
    return (orderTotal * this.discountValue) / 100;
  } else {
    return Math.min(this.discountValue, orderTotal);
  }
};

// Method to apply discount to order
discountSchema.methods.applyToOrder = function(order, user = null) {
  const validation = this.isValidForOrder(order, user);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
  
  const discountAmount = this.calculateDiscount(order.totalAmount);
  const newTotal = Math.max(0, order.totalAmount - discountAmount);
  
  return {
    originalTotal: order.totalAmount,
    discountAmount: discountAmount,
    newTotal: newTotal,
    discountCode: this.code,
    discountName: this.name
  };
};

// Static method to find valid discounts for an order
discountSchema.statics.findValidDiscounts = async function(branchId, order, user = null) {
  const discounts = await this.find({
    branchId: branchId,
    isActive: true
  });
  
  const validDiscounts = [];
  
  for (const discount of discounts) {
    const validation = discount.isValidForOrder(order, user);
    if (validation.valid) {
      validDiscounts.push({
        discount: discount,
        discountAmount: discount.calculateDiscount(order.totalAmount)
      });
    }
  }
  
  // Sort by discount amount (highest first)
  return validDiscounts.sort((a, b) => b.discountAmount - a.discountAmount);
};

const Discount = mongoose.model('Discount', discountSchema);

module.exports = Discount; 
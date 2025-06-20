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
    },
    // Audit Log Fields
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
    
    // Check outlets format (Map)
    if (this.outlets && this.outlets.size > 0) {
      // If we have specific branch entries, check if this branch is enabled
      if (this.outlets.has(checkBranchId)) {
        isBranchEnabled = this.outlets.get(checkBranchId);
      } else {
        // If the branch isn't in the list, default to false
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
  
  // Check day availability - Fixed the weekday issue
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  if (!this.daysAvailable[dayName]) {
    return { valid: false, reason: 'Discount not available today' };
  }
  
  // Check service type using orderType (preferred) or deliveryMethod (fallback)
  const orderTypeToCheck = order.orderType || order.deliveryMethod;
  if (orderTypeToCheck) {
    const serviceTypeMap = {
      'collection': 'collection',
      'pickup': 'collection',
      'delivery': 'delivery',
      'dine_in': 'tableOrdering',
      'tableordering': 'tableOrdering',
      'table-ordering': 'tableOrdering'
    };
    
    const serviceType = serviceTypeMap[orderTypeToCheck.toLowerCase()];
    if (serviceType && !this.serviceTypes[serviceType]) {
      return { valid: false, reason: `Discount not available for ${orderTypeToCheck}` };
    }
  }
  
  // Check first order only (if user provided)
  if (this.firstOrderOnly && user) {
    // This would need to be checked against user's order history
    // For now, we'll assume it's valid
  }
  
  return { valid: true };
};

// Helper method to get current usage statistics for a user
discountSchema.methods.getUserUsageStats = async function(userId) {
  const Order = require('./order.model');
  
  try {
    const userOrders = await Order.find({
      $or: [
        { 'discountApplied.discountId': this._id },
        { 'discount.discountId': this._id }
      ],
      user: userId,
      status: { $ne: 'cancelled' }
    }).select('_id createdAt discount discountApplied');
    
    console.log(`Found ${userOrders.length} orders for user ${userId} with discount ${this.code}`);
    console.log('Orders:', userOrders.map(order => ({
      id: order._id,
      createdAt: order.createdAt,
      hasDiscount: !!order.discount,
      hasDiscountApplied: !!order.discountApplied
    })));
    
    return {
      totalUsage: userOrders.length,
      orders: userOrders
    };
  } catch (error) {
    console.error('Error getting user usage stats:', error);
    return { totalUsage: 0, orders: [] };
  }
};

// Comprehensive validation method for order creation with usage tracking
discountSchema.methods.validateForOrderCreation = async function(order, userId = null, branchId = null) {
  const Order = require('./order.model');
  
  // Priority 1: Check if coupon exists and is active
  if (!this.isActive) {
    return { valid: false, reason: 'Coupon code is not active' };
  }
  
  // Priority 2: Check if discount is available for the branch
  if (branchId) {
    let isBranchEnabled = true;
    
    if (this.outlets && this.outlets.size > 0) {
      if (this.outlets.has(branchId)) {
        isBranchEnabled = this.outlets.get(branchId);
      } else {
        isBranchEnabled = false;
      }
    }
    
    if (!isBranchEnabled) {
      return { valid: false, reason: 'Coupon not available at this branch' };
    }
  }
  
  // Priority 3: Check service type (order type)
  const orderTypeToCheck = order.orderType || order.deliveryMethod;
  if (orderTypeToCheck) {
    const serviceTypeMap = {
      'collection': 'collection',
      'pickup': 'collection',
      'delivery': 'delivery',
      'dine_in': 'tableOrdering',
      'tableordering': 'tableOrdering',
      'table-ordering': 'tableOrdering'
    };
    
    const serviceType = serviceTypeMap[orderTypeToCheck.toLowerCase()];
    if (serviceType && !this.serviceTypes[serviceType]) {
      return { valid: false, reason: `Coupon not available for ${orderTypeToCheck} orders` };
    }
  }
  
  // Priority 4: Check usage limits
  try {
    // Check total usage limit
    if (this.maxUses.total > 0) {
      const totalUsageCount = await Order.countDocuments({
        $or: [
          { 'discountApplied.discountId': this._id },
          { 'discount.discountId': this._id }
        ],
        status: { $ne: 'cancelled' }
      });
      
      if (totalUsageCount >= this.maxUses.total) {
        return { valid: false, reason: 'Coupon usage limit exceeded' };
      }
    }
    
    // Check per customer usage limit
    if (this.maxUses.perCustomer > 0 && userId) {
      const usageStats = await this.getUserUsageStats(userId);
      const customerUsageCount = usageStats.totalUsage;
      
      console.log(`User ${userId} has used coupon ${this.code} ${customerUsageCount} times. Limit: ${this.maxUses.perCustomer}`);
      
      if (customerUsageCount >= this.maxUses.perCustomer) {
        return { valid: false, reason: `You have reached the maximum usage limit (${this.maxUses.perCustomer}) for this coupon` };
      }
    }
    
    // Check per day usage limit
    if (this.maxUses.perDay > 0) {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      const dailyUsageCount = await Order.countDocuments({
        $or: [
          { 'discountApplied.discountId': this._id },
          { 'discount.discountId': this._id }
        ],
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'cancelled' }
      });
      
      if (dailyUsageCount >= this.maxUses.perDay) {
        return { valid: false, reason: 'Daily usage limit for this coupon has been reached' };
      }
    }
  } catch (error) {
    console.error('Error checking usage limits:', error);
    return { valid: false, reason: 'Error validating coupon usage' };
  }
  
  // Priority 5: Check day availability
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  if (!this.daysAvailable[dayName]) {
    return { valid: false, reason: 'Coupon not available today' };
  }
  
  // Priority 6: Check minimum and maximum spend
  if (order.totalAmount < this.minSpend) {
    return { valid: false, reason: `Minimum spend of £${this.minSpend.toFixed(2)} required` };
  }
  
  if (this.maxSpend > 0 && order.totalAmount > this.maxSpend) {
    return { valid: false, reason: `Maximum spend of £${this.maxSpend.toFixed(2)} exceeded` };
  }
  
  // Priority 7: Check first order only requirement
  if (this.firstOrderOnly && userId) {
    try {
      const existingOrderCount = await Order.countDocuments({
        user: userId,
        status: { $ne: 'cancelled' }
      });
      
      if (existingOrderCount > 0) {
        return { valid: false, reason: 'This coupon is only valid for first-time customers' };
      }
    } catch (error) {
      console.error('Error checking first order requirement:', error);
      return { valid: false, reason: 'Error validating first order requirement' };
    }
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
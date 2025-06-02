const mongoose = require('mongoose');

const serviceChargeSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    orderType: {
      type: String,
      enum: ['All', 'Collection', 'Delivery', 'Table'],
      required: [true, 'Order type is required'],
      default: 'All'
    },
    chargeType: {
      type: String,
      enum: ['Fixed', 'Percentage'],
      required: [true, 'Charge type is required'],
      default: 'Fixed'
    },
    value: {
      type: Number,
      required: [true, 'Charge value is required'],
      min: [0, 'Charge value cannot be negative']
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
    optional: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required']
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
serviceChargeSchema.index({ branchId: 1, orderType: 1 });
serviceChargeSchema.index({ branchId: 1, isActive: 1 });

// Virtual for formatted charge display
serviceChargeSchema.virtual('formattedCharge').get(function() {
  if (this.chargeType === 'Percentage') {
    return `${this.value}%`;
  } else {
    return `£${this.value.toFixed(2)}`;
  }
});

// Method to calculate service charge for an order
serviceChargeSchema.methods.calculateCharge = function(orderTotal) {
  // Check if order meets minimum spend requirement
  if (orderTotal < this.minSpend) {
    return 0;
  }
  
  // Check if order exceeds maximum spend (if set)
  if (this.maxSpend > 0 && orderTotal > this.maxSpend) {
    return 0;
  }
  
  if (this.chargeType === 'Percentage') {
    return (orderTotal * this.value) / 100;
  } else {
    return this.value;
  }
};

// Method to check if service charge applies to order type
serviceChargeSchema.methods.appliesTo = function(orderType) {
  if (this.orderType === 'All') {
    return true;
  }
  
  // Map frontend order types to our enum values
  const orderTypeMap = {
    'pickup': 'Collection',
    'collection': 'Collection',
    'delivery': 'Delivery',
    'dine_in': 'Table',
    'table': 'Table'
  };
  
  const mappedOrderType = orderTypeMap[orderType.toLowerCase()] || orderType;
  return this.orderType === mappedOrderType;
};

// Static method to find applicable service charges
serviceChargeSchema.statics.findApplicableCharges = async function(branchId, orderType, orderTotal) {
  const charges = await this.find({
    branchId: branchId,
    isActive: true
  }).populate('createdBy', 'name email');
  
  const applicableCharges = [];
  
  for (const charge of charges) {
    if (charge.appliesTo(orderType)) {
      const chargeAmount = charge.calculateCharge(orderTotal);
      if (chargeAmount > 0) {
        applicableCharges.push({
          charge: charge,
          amount: chargeAmount
        });
      }
    }
  }
  
  return applicableCharges;
};

// Static method to calculate total service charges
serviceChargeSchema.statics.calculateTotalCharges = async function(branchId, orderType, orderTotal, includeOptional = true) {
  const applicableCharges = await this.findApplicableCharges(branchId, orderType, orderTotal);
  
  let totalMandatory = 0;
  let totalOptional = 0;
  const chargeBreakdown = [];
  
  for (const { charge, amount } of applicableCharges) {
    if (charge.optional && !includeOptional) {
      continue;
    }
    
    chargeBreakdown.push({
      id: charge._id,
      name: `${charge.orderType} Service Charge`,
      type: charge.chargeType,
      value: charge.value,
      amount: amount,
      optional: charge.optional
    });
    
    if (charge.optional) {
      totalOptional += amount;
    } else {
      totalMandatory += amount;
    }
  }
  
  return {
    totalMandatory,
    totalOptional,
    totalAll: totalMandatory + totalOptional,
    breakdown: chargeBreakdown
  };
};

const ServiceCharge = mongoose.model('ServiceCharge', serviceChargeSchema);

module.exports = ServiceCharge; 
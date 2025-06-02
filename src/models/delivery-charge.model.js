const mongoose = require('mongoose');

// Delivery charge schema for distance-based pricing
const deliveryChargeSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    maxDistance: {
      type: Number,
      required: [true, 'Maximum distance is required'],
      min: [0, 'Distance cannot be negative']
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
    charge: {
      type: Number,
      required: [true, 'Delivery charge is required'],
      min: [0, 'Charge cannot be negative']
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

// Price override schema for postcode-specific pricing
const priceOverrideSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    prefix: {
      type: String,
      required: [true, 'Postcode prefix is required'],
      trim: true,
      uppercase: true
    },
    postfix: {
      type: String,
      default: '',
      trim: true,
      uppercase: true
    },
    minSpend: {
      type: Number,
      default: 0,
      min: [0, 'Minimum spend cannot be negative']
    },
    charge: {
      type: Number,
      required: [true, 'Override charge is required'],
      min: [0, 'Charge cannot be negative']
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

// Postcode exclusion schema for areas not served
const postcodeExclusionSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    prefix: {
      type: String,
      required: [true, 'Postcode prefix is required'],
      trim: true,
      uppercase: true
    },
    postfix: {
      type: String,
      default: '',
      trim: true,
      uppercase: true
    },
    reason: {
      type: String,
      default: 'Area not served'
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
deliveryChargeSchema.index({ branchId: 1, maxDistance: 1 });
deliveryChargeSchema.index({ branchId: 1, isActive: 1 });

priceOverrideSchema.index({ branchId: 1, prefix: 1, postfix: 1 }, { unique: true });
priceOverrideSchema.index({ branchId: 1, isActive: 1 });

postcodeExclusionSchema.index({ branchId: 1, prefix: 1, postfix: 1 }, { unique: true });
postcodeExclusionSchema.index({ branchId: 1, isActive: 1 });

// Virtual for full postcode in overrides
priceOverrideSchema.virtual('fullPostcode').get(function() {
  return this.postfix ? `${this.prefix} ${this.postfix}` : this.prefix;
});

// Virtual for full postcode in exclusions
postcodeExclusionSchema.virtual('fullPostcode').get(function() {
  return this.postfix ? `${this.prefix} ${this.postfix}` : this.prefix;
});

// Static method to find applicable delivery charge
deliveryChargeSchema.statics.findApplicableCharge = async function(branchId, distance, orderTotal) {
  const charges = await this.find({
    branchId: branchId,
    maxDistance: { $gte: distance },
    isActive: true
  }).sort({ maxDistance: 1 });
  
  for (const charge of charges) {
    if (charge.minSpend <= orderTotal && (charge.maxSpend === 0 || orderTotal <= charge.maxSpend)) {
      return charge;
    }
  }
  
  return null;
};

// Static method to check postcode override
priceOverrideSchema.statics.findPostcodeOverride = async function(branchId, postcode) {
  const normalizedPostcode = postcode.toUpperCase().replace(/\s+/g, ' ').trim();
  const parts = normalizedPostcode.split(' ');
  
  // Try exact match first
  let override = await this.findOne({
    branchId: branchId,
    prefix: parts[0],
    postfix: parts[1] || '',
    isActive: true
  });
  
  // If no exact match, try prefix only
  if (!override) {
    override = await this.findOne({
      branchId: branchId,
      prefix: parts[0],
      postfix: '',
      isActive: true
    });
  }
  
  return override;
};

// Static method to check if postcode is excluded
postcodeExclusionSchema.statics.isPostcodeExcluded = async function(branchId, postcode) {
  const normalizedPostcode = postcode.toUpperCase().replace(/\s+/g, ' ').trim();
  const parts = normalizedPostcode.split(' ');
  
  // Check exact match first
  let exclusion = await this.findOne({
    branchId: branchId,
    prefix: parts[0],
    postfix: parts[1] || '',
    isActive: true
  });
  
  // If no exact match, check prefix only
  if (!exclusion) {
    exclusion = await this.findOne({
      branchId: branchId,
      prefix: parts[0],
      postfix: '',
      isActive: true
    });
  }
  
  return !!exclusion;
};

const DeliveryCharge = mongoose.model('DeliveryCharge', deliveryChargeSchema);
const PriceOverride = mongoose.model('PriceOverride', priceOverrideSchema);
const PostcodeExclusion = mongoose.model('PostcodeExclusion', postcodeExclusionSchema);

module.exports = {
  DeliveryCharge,
  PriceOverride,
  PostcodeExclusion
}; 
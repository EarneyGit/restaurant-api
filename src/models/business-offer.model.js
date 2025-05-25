const mongoose = require('mongoose');

const businessOfferSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    title: {
      type: String,
      required: [true, 'Offer title is required'],
      trim: true,
      maxlength: [200, 'Title cannot be more than 200 characters']
    },
    content: {
      type: String,
      required: [true, 'Offer content is required'],
      trim: true
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative']
    },
    image: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Created by admin user
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required']
    },
    // View and interaction tracking
    stats: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      lastViewed: { type: Date, default: null }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
businessOfferSchema.index({ branchId: 1, isActive: 1 });
businessOfferSchema.index({ branchId: 1, displayOrder: 1 });
businessOfferSchema.index({ startDate: 1, endDate: 1 });

// Virtual for checking if offer is currently active
businessOfferSchema.virtual('isCurrentlyActive').get(function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  
  // Check start date
  if (this.startDate && now < this.startDate) return false;
  
  // Check end date
  if (this.endDate && now > this.endDate) return false;
  
  return true;
});

// Method to increment view count
businessOfferSchema.methods.incrementViews = function() {
  this.stats.views += 1;
  this.stats.lastViewed = new Date();
  return this.save();
};

// Method to increment click count
businessOfferSchema.methods.incrementClicks = function() {
  this.stats.clicks += 1;
  return this.save();
};

// Static method to get active offers for a branch
businessOfferSchema.statics.getActiveOffers = async function(branchId) {
  const now = new Date();
  
  return await this.find({
    branchId: branchId,
    isActive: true,
    $or: [
      { startDate: null },
      { startDate: { $lte: now } }
    ],
    $or: [
      { endDate: null },
      { endDate: { $gte: now } }
    ]
  }).sort({ displayOrder: 1, createdAt: -1 });
};

// Static method to get offers with pagination
businessOfferSchema.statics.getPaginatedOffers = async function(branchId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  const offers = await this.find({ branchId: branchId })
    .sort({ displayOrder: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name email');
  
  const total = await this.countDocuments({ branchId: branchId });
  
  return {
    offers,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalOffers: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  };
};

const BusinessOffer = mongoose.model('BusinessOffer', businessOfferSchema);

module.exports = BusinessOffer; 
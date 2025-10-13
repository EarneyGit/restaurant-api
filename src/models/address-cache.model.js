const mongoose = require('mongoose');

// Address cache schema for storing Ideal Postcodes API responses
const addressCacheSchema = new mongoose.Schema(
  {
    postcode: {
      type: String,
      required: [true, 'Postcode is required'],
      trim: true,
      uppercase: true,
      unique: true,
      index: true
    },
    normalizedPostcode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    addresses: [{
      postcode: String,
      postcode_inward: String,
      postcode_outward: String,
      post_town: String,
      dependant_locality: String,
      double_dependant_locality: String,
      thoroughfare: String,
      dependant_thoroughfare: String,
      building_number: String,
      building_name: String,
      sub_building_name: String,
      po_box: String,
      department_name: String,
      organisation_name: String,
      udprn: Number,
      postcode_type: String,
      su_organisation_indicator: String,
      delivery_point_suffix: String,
      line_1: String,
      line_2: String,
      line_3: String,
      premise: String,
      longitude: Number,
      latitude: Number,
      eastings: Number,
      northings: Number,
      country: String,
      traditional_county: String,
      administrative_county: String,
      postal_county: String,
      county: String,
      district: String,
      ward: String,
      uprn: String,
      id: String,
      country_iso: String,
      country_iso_2: String,
      county_code: String,
      language: String,
      umprn: String,
      dataset: String
    }],
    lastFetchedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    fetchCount: {
      type: Number,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for efficient querying
addressCacheSchema.index({ postcode: 1, expiresAt: 1 });
addressCacheSchema.index({ normalizedPostcode: 1, isActive: 1 });

// Virtual to check if cache is expired
addressCacheSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Virtual to check if cache needs refresh (within 6 hours of expiry)
addressCacheSchema.virtual('needsRefresh').get(function() {
  const sixHoursBeforeExpiry = new Date(this.expiresAt.getTime() - (6 * 60 * 60 * 1000));
  return new Date() > sixHoursBeforeExpiry;
});

// Static method to find valid cache entry
addressCacheSchema.statics.findValidCache = async function(postcode) {
  const normalizedPostcode = postcode.trim().toUpperCase().replace(/\s+/g, '');
  
  const cache = await this.findOne({
    normalizedPostcode,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
  
  return cache;
};

// Static method to create or update cache
addressCacheSchema.statics.upsertCache = async function(postcode, addresses) {
  const normalizedPostcode = postcode.trim().toUpperCase().replace(/\s+/g, '');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (4032 * 60 * 60 * 1000)); // 4 week in hours
  
  const cache = await this.findOneAndUpdate(
    { normalizedPostcode },
    {
      $set: {
        postcode: postcode.trim().toUpperCase(),
        normalizedPostcode,
        addresses,
        lastFetchedAt: now,
        expiresAt,
        isActive: true
      },
      $inc: { fetchCount: 1 }
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );
  
  return cache;
};

// Static method to cleanup expired caches (can be run as a cron job)
addressCacheSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result;
};

// Pre-save hook to set normalized postcode
addressCacheSchema.pre('save', function(next) {
  if (this.postcode && !this.normalizedPostcode) {
    this.normalizedPostcode = this.postcode.trim().toUpperCase().replace(/\s+/g, '');
  }
  next();
});

const AddressCache = mongoose.model('AddressCache', addressCacheSchema);

module.exports = AddressCache;


const mongoose = require('mongoose');

// Cache distances between two coordinates (branch => customer)
const distanceCacheSchema = new mongoose.Schema(
  {
    fromLat: { type: Number, required: true },
    fromLng: { type: Number, required: true },
    toLat: { type: Number, required: true },
    toLng: { type: Number, required: true },
    // Distance in meters
    distanceMeters: { type: Number, required: true, min: 0 },
    // Normalized string keys for efficient exact lookup
    fromKey: { type: String, required: true, index: true },
    toKey: { type: String, required: true, index: true },
    // Optional metadata
    source: { type: String, enum: ['google', 'manual', 'cache'], default: 'google' },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

// Unique compound index to prevent duplicates
// We use keys with rounded coordinates to avoid excessive cardinality
distanceCacheSchema.index({ fromKey: 1, toKey: 1 }, { unique: true });

// Helper to build a normalized key from coordinates (rounded to 5 decimals)
function toKey(lat, lng) {
  const r = (n) => Number(n).toFixed(5);
  return `${r(lat)},${r(lng)}`;
}

// Static: find a cached distance for given pair
distanceCacheSchema.statics.findCachedDistance = async function(fromLat, fromLng, toLat, toLng) {
  const fromKey = toKey(fromLat, fromLng);
  const toKeyStr = toKey(toLat, toLng);
  const now = new Date();
  const doc = await this.findOne({ fromKey, toKey: toKeyStr, expiresAt: { $gt: now } });
  return doc || null;
};

// Static: upsert (create or update) a cache entry for a pair
// ttlHours: how long the cache should remain valid
distanceCacheSchema.statics.upsertDistance = async function(fromLat, fromLng, toLat, toLng, distanceMeters, source = 'google', ttlHours = 4032) { //  4 week in hours
  const fromKey = toKey(fromLat, fromLng);
  const toKeyStr = toKey(toLat, toLng);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000); //  4 week in hours
  const update = {
    $set: {
      fromLat,
      fromLng,
      toLat,
      toLng,
      distanceMeters,
      source,
      expiresAt,
    },
  };

  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  const doc = await this.findOneAndUpdate({ fromKey, toKey: toKeyStr }, update, options);
  return doc;
};

const DistanceCache = mongoose.model('DistanceCache', distanceCacheSchema);

module.exports = DistanceCache;

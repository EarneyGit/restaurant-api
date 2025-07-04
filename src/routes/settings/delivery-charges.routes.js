const express = require('express');
const {
  getDeliveryCharges,
  getDeliveryCharge,
  createDeliveryCharge,
  updateDeliveryCharge,
  deleteDeliveryCharge,
  createBulkDeliveryCharges,
  getPriceOverrides,
  createPriceOverride,
  updatePriceOverride,
  deletePriceOverride,
  getPostcodeExclusions,
  createPostcodeExclusion,
  updatePostcodeExclusion,
  deletePostcodeExclusion,
  calculateDeliveryCharge
} = require('../../controllers/delivery-charge.controller');

const { protect } = require('../../middleware/auth.middleware');

const router = express.Router();

// Specific routes must come before parameterized routes
// Bulk operations
router.route('/bulk')
  .post(protect, createBulkDeliveryCharges);

// Calculate delivery charge (public endpoint)
router.route('/calculate')
  .post(calculateDeliveryCharge);

// Price Overrides Routes
router.route('/price-overrides')
  .get(protect, getPriceOverrides)
  .post(protect, createPriceOverride);

router.route('/price-overrides/:id')
  .put(protect, updatePriceOverride)
  .delete(protect, deletePriceOverride);

// Postcode Exclusions Routes
router.route('/postcode-exclusions')
  .get(protect, getPostcodeExclusions)
  .post(protect, createPostcodeExclusion);

router.route('/postcode-exclusions/:id')
  .put(protect, updatePostcodeExclusion)
  .delete(protect, deletePostcodeExclusion);

// Delivery Charges Routes (parameterized routes come last)
router.route('/')
  .get(protect, getDeliveryCharges)
  .post(protect, createDeliveryCharge);

router.route('/:id')
  .get(protect, getDeliveryCharge)
  .put(protect, updateDeliveryCharge)
  .delete(protect, deleteDeliveryCharge);

module.exports = router; 
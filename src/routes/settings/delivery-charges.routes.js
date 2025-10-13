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
  calculateDeliveryCharge,
  calculateDeliveryChargeByCoordinates,
  calculateDeliveryChargeForCheckout,
  validateDeliveryDistance,
  getBranchLocationForCharges
} = require('../../controllers/delivery-charge.controller');

const { protect } = require('../../middleware/auth.middleware');

const router = express.Router();

// Specific routes must come before parameterized routes
// Bulk operations
router.route('/bulk')
  .post(protect, createBulkDeliveryCharges);

// Calculate delivery charge (public endpoints)
router.route('/calculate')
  .post(calculateDeliveryCharge);

router.route('/calculate-by-coordinates')
  .post(calculateDeliveryChargeByCoordinates);

// Calculate delivery charge for checkout (with user address handling)
router.route('/calculate-checkout')
  .post(calculateDeliveryChargeForCheckout);

// Validate delivery distance with meaningful error messages
router.route('/validate-delivery')
  .post(validateDeliveryDistance);

// Get branch location for delivery charges (protected)
router.route('/branch-location')
  .get(protect, getBranchLocationForCharges);

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
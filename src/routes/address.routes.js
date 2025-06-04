const express = require('express');
const {
  postcodeToAddress,
  getAddressByPostcode,
  validatePostcode,
  batchPostcodeToAddress,
  getApiStatus,
  calculateDistance,
  getAddressByPostcodeIdeal
} = require('../controllers/address.controller');

// Import authentication middleware
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes (no authentication required)
router.post('/postcode-to-address', postcodeToAddress);
// router.get('/postcode/:postcode', getAddressByPostcode);
router.get('/postcode/:postcode', getAddressByPostcodeIdeal);
router.post('/validate-postcode', validatePostcode);
router.post('/distance', calculateDistance);

// Protected routes (admin only)
router.use(protect);
router.use(admin);

router.post('/batch-postcode-to-address', batchPostcodeToAddress);
router.get('/status', getApiStatus);

module.exports = router; 
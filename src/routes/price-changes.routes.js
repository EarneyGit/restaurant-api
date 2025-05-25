const express = require('express');
const {
  getPriceChangesData,
  applyPriceChanges,
  getPriceChangesList,
  updatePriceChange,
  removePriceChange
} = require('../controllers/price-changes.controller');

// Import authentication middleware
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication (admin, manager, staff only)
router.use(protect);

// Get categories with products for price changes form
router.get('/', getPriceChangesData);

// Apply price changes to products
router.post('/', applyPriceChanges);

// Get list of all price changes
router.get('/list', getPriceChangesList);

// Update specific price change
router.put('/:id', updatePriceChange);

// Remove specific price change
router.delete('/:id', removePriceChange);

module.exports = router; 
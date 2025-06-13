const express = require('express');
const {
  getPriceChangesData,
  applyPriceChanges,
  getPriceChangesList,
  updatePriceChange,
  deletePriceChange,
  getTemporaryPriceChanges,
  getPriceChangeDetails,
  getEffectivePrices,
  togglePriceChange,
  revertExpiredPriceChanges,
  createIndividualPriceChange,
  getProductPriceChanges
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

// Create individual price change for a product (for product modals)
router.post('/individual', createIndividualPriceChange);

// Get temporary price changes categorized by status (Current, Future, Historical)
router.get('/temporary', getTemporaryPriceChanges);

// Get current effective prices for products
router.get('/effective-prices', getEffectivePrices);

// Get list of all price changes (legacy endpoint)
router.get('/list', getPriceChangesList);

// Get price changes for a specific product
router.get('/product/:productId', getProductPriceChanges);

// Revert expired price changes (manual trigger)
router.post('/revert-expired', revertExpiredPriceChanges);

// Get details of a specific price change
router.get('/:id/details', getPriceChangeDetails);

// Toggle price change active status
router.patch('/:id/toggle', togglePriceChange);

// Update specific price change
router.put('/:id', updatePriceChange);

// Delete specific price change
router.delete('/:id', deletePriceChange);

module.exports = router; 
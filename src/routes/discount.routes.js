const express = require('express');
const {
  getDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscountCode,
  getDiscountStats
} = require('../controllers/discount.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.post('/validate', validateDiscountCode);

// Protected routes (require authentication)
router.use(protect);

// Admin routes
router.route('/')
  .get(getDiscounts)
  .post(createDiscount);

router.get('/stats', getDiscountStats);

router.route('/:id')
  .get(getDiscount)
  .put(updateDiscount)
  .delete(deleteDiscount);

module.exports = router; 
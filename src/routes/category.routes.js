const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts,
  getCategoryProductCounts
} = require('../controllers/category.controller');
const { uploadSingle } = require('../middleware/upload');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes with optional authentication (branch-based)
router.get('/', optionalAuth, getCategories);
router.get('/counts', optionalAuth, getCategoryProductCounts);
router.get('/:id', optionalAuth, getCategory);
router.get('/:id/products', optionalAuth, getCategoryProducts);

// Protected routes (write operations) - allow admin, manager, staff
router.post('/', protect, uploadSingle, createCategory);
router.put('/:id', protect, uploadSingle, updateCategory);
router.delete('/:id', protect, deleteCategory);

module.exports = router; 
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
const handleUploadErrors = require('../utils/handleUploadErrors');

const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getCategories);
router.get('/counts', optionalAuth, getCategoryProductCounts);
router.get('/:id', optionalAuth, getCategory);
router.get('/:id/products', optionalAuth, getCategoryProducts);

// Protected routes with file upload + error handling
router.post('/', protect, handleUploadErrors(uploadSingle), createCategory);
router.put('/:id', protect, handleUploadErrors(uploadSingle), updateCategory);
router.delete('/:id', protect, deleteCategory);

module.exports = router;

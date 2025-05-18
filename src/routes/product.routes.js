const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getPopularProducts,
  getRecommendedProducts
} = require('../controllers/product.controller');

const { protect, admin, manager, staff } = require('../middleware/auth.middleware');

const router = express.Router();

// Special routes
router.get('/popular', getPopularProducts);
router.get('/recommended', getRecommendedProducts);

// Public routes (accessible to all)
router.get('/', getProducts);
router.get('/:id', getProduct);

// Protected routes (require authentication and proper role)
router.post('/', protect, staff, createProduct); // Staff, Manager, Admin can create
router.put('/:id', protect, staff, updateProduct); // Staff, Manager, Admin can update
router.delete('/:id', protect, manager, deleteProduct); // Only Manager and Admin can delete

module.exports = router; 
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

const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Special routes
router.get('/popular', getPopularProducts);
router.get('/recommended', getRecommendedProducts);

// Standard routes
router.route('/')
  .get(getProducts)
  .post(protect, admin, createProduct);

router.route('/:id')
  .get(getProduct)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

module.exports = router; 
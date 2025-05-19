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

const router = express.Router();

// All routes are now public
router.get('/popular', getPopularProducts);
router.get('/recommended', getRecommendedProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router; 
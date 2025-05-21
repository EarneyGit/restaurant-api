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

const router = express.Router();

// All routes are now public
router.get('/', getCategories);
router.get('/counts', getCategoryProductCounts);
router.get('/:id', getCategory);
router.post('/', uploadSingle, createCategory);
router.put('/:id', uploadSingle, updateCategory);
router.delete('/:id', deleteCategory);

// Get category products
router.route('/:id/products')
  .get(getCategoryProducts);

module.exports = router; 
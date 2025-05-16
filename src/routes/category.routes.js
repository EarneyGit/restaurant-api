const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts
} = require('../controllers/category.controller');

const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Get all categories and create category
router.route('/')
  .get(getCategories)
  .post(protect, admin, createCategory);

// Get category products
router.route('/:id/products')
  .get(getCategoryProducts);

// Get, update and delete category
router.route('/:id')
  .get(getCategory)
  .put(protect, admin, updateCategory)
  .delete(protect, admin, deleteCategory);

module.exports = router; 
const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts
} = require('../controllers/category.controller');

const { protect, admin, manager, staff } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes (accessible to all)
router.get('/', getCategories);
router.get('/:id', getCategory);

// Protected routes (require authentication and proper role)
router.post('/', protect, staff, createCategory); // Staff, Manager, Admin can create
router.put('/:id', protect, staff, updateCategory); // Staff, Manager, Admin can update
router.delete('/:id', protect, manager, deleteCategory); // Only Manager and Admin can delete

// Get category products
router.route('/:id/products')
  .get(getCategoryProducts);

module.exports = router; 
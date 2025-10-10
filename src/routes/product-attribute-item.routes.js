const express = require('express');
const multer = require('multer');
const {
  getProductAttributeItems,
  getProductAttributeItem,
  createProductAttributeItem,
  updateProductAttributeItem,
  deleteProductAttributeItem,
  getAttributeItemsByProduct,
  getAttributeItemsByAttribute,
  bulkCreateAttributeItems,
  updateAttributeItemStock,
  copyAttributesBetweenProducts,
  copyAttributesToCategory,
  getAttributeOptions,
  updateAttributeItemHiddenStatus
} = require('../controllers/product-attribute-item.controller');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Basic CRUD routes
router.route('/')
  .get(optionalAuth, getProductAttributeItems)
  .post(protect, upload.single('image'), createProductAttributeItem);

router.route('/:id')
  .get(optionalAuth, getProductAttributeItem)
  .put(protect, upload.single('image'), updateProductAttributeItem)
  .delete(protect, deleteProductAttributeItem);

// Specialized routes
router.get('/product/:productId', optionalAuth, getAttributeItemsByProduct);
router.get('/attribute/:attributeId', optionalAuth, getAttributeItemsByAttribute);
router.get('/attribute/:attributeId/options', optionalAuth, getAttributeOptions);

// Bulk operations
router.post('/bulk', protect, bulkCreateAttributeItems);

// Copy operations
router.post('/copy', protect, copyAttributesBetweenProducts);
router.post('/copy-to-category', protect, copyAttributesToCategory);

// Stock management
router.patch('/:id/stock', protect, updateAttributeItemStock);

// Hidden status management
router.patch('/:id/hidden-status', protect, updateAttributeItemHiddenStatus);

module.exports = router; 
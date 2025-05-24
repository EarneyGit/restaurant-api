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
  updateAttributeItemStock
} = require('../controllers/product-attribute-item.controller');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
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

// Special routes
router.get('/product/:productId', getAttributeItemsByProduct);
router.get('/attribute/:attributeId', getAttributeItemsByAttribute);

// Bulk operations and stock management - allow admin, manager, staff
router.post('/bulk', protect, bulkCreateAttributeItems);
router.put('/:id/stock', protect, updateAttributeItemStock);

module.exports = router; 
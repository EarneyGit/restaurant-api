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
const { protect, admin } = require('../middleware/auth.middleware');

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
  .get(getProductAttributeItems)
  .post(protect, admin, upload.single('image'), createProductAttributeItem);

router.route('/:id')
  .get(getProductAttributeItem)
  .put(protect, admin, upload.single('image'), updateProductAttributeItem)
  .delete(protect, admin, deleteProductAttributeItem);

// Special routes
router.get('/product/:productId', getAttributeItemsByProduct);
router.get('/attribute/:attributeId', getAttributeItemsByAttribute);
router.post('/bulk', protect, admin, bulkCreateAttributeItems);
router.put('/:id/stock', protect, admin, updateAttributeItemStock);

module.exports = router; 
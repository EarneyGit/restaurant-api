const express = require('express');
const multer = require('multer');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getPopularProducts,
  getRecommendedProducts,
  bulkUpdateStock,
  getStockStatus,
  getOfflineProducts,
  toggleProductOffline,
  toggleAllProductsOffline
} = require('../controllers/product.controller');
const { ALLOWED_FILE_TYPES } = require('../utils/fileUpload');

// Import authentication middleware
const { protect, admin, staff, optionalAuth, manager } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10 // Maximum 10 files per request
  }
});

// Public routes with optional authentication (branch-based)
router.get('/popular', optionalAuth, getPopularProducts);
router.get('/recommended', optionalAuth, getRecommendedProducts);
router.get('/stock/status', optionalAuth, getStockStatus);
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProduct);

// Protected routes for staff and above
router.get('/offline', protect, staff, getOfflineProducts);
router.patch('/toggle-all-offline', protect, staff, toggleAllProductsOffline);
router.patch('/:id/toggle-offline', protect, staff, toggleProductOffline);
router.put('/stock/bulk-update', protect, staff, bulkUpdateStock);

// Protected routes for admin only
router.post('/', protect, staff, upload.array('images', 10), createProduct);
router.put('/:id', protect, staff, upload.array('images', 10), updateProduct);
router.delete('/:id', protect, staff, deleteProduct);

module.exports = router; 
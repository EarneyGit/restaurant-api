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
  getStockStatus
} = require('../controllers/product.controller');
const { ALLOWED_FILE_TYPES } = require('../utils/fileUpload');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

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

// Protected routes (write operations) - allow admin, manager, staff
router.put('/stock/bulk-update', protect, bulkUpdateStock);
router.post('/', protect, upload.array('images', 10), createProduct);
router.put('/:id', protect, upload.array('images', 10), updateProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router; 
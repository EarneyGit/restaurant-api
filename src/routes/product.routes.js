const express = require('express');
const multer = require('multer');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getPopularProducts,
  getRecommendedProducts
} = require('../controllers/product.controller');
const { ALLOWED_FILE_TYPES } = require('../utils/fileUpload');

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

// All routes are public
router.get('/popular', getPopularProducts);
router.get('/recommended', getRecommendedProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', upload.array('images', 10), createProduct);
router.put('/:id', upload.array('images', 10), updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router; 
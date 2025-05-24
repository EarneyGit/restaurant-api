const express = require('express');
const {
  getAttributes,
  getAttribute,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  getAttributesByBranch,
  reorderAttributes
} = require('../controllers/attribute.controller');

// Import authentication middleware
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Basic CRUD routes
router.route('/')
  .get(getAttributes)
  .post(protect, admin, createAttribute);

router.route('/:id')
  .get(getAttribute)
  .put(protect, admin, updateAttribute)
  .delete(protect, admin, deleteAttribute);

// Special routes
router.get('/branch/:branchId', getAttributesByBranch);
router.put('/reorder', protect, admin, reorderAttributes);

module.exports = router; 
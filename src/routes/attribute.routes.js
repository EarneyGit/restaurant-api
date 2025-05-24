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
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes with optional authentication (branch-based)
router.route('/')
  .get(optionalAuth, getAttributes);

router.route('/:id')
  .get(optionalAuth, getAttribute);

// Special public routes
router.get('/branch/:branchId', optionalAuth, getAttributesByBranch);

// Protected routes (write operations) - allow admin, manager, staff
router.route('/')
  .get(optionalAuth, getAttributes) // Public read with branch filtering
  .post(protect, createAttribute);

router.route('/:id')
  .put(protect, updateAttribute)
  .delete(protect, deleteAttribute);

router.put('/reorder', protect, reorderAttributes);

module.exports = router; 
const express = require('express');
const {
  getAttributes,
  getAttribute,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  getAttributesByBranch,
  reorderAttributes,
  getOfflineAttributes,
  toggleAttributeOffline
} = require('../controllers/attribute.controller');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Special routes that must come before parameterized routes
router.get('/offline', protect, getOfflineAttributes);
router.get('/branch/:branchId', optionalAuth, getAttributesByBranch);
router.put('/reorder', protect, reorderAttributes);

// Public routes with optional authentication (branch-based)
router.route('/')
  .get(optionalAuth, getAttributes)
  .post(protect, createAttribute);

// Parameterized routes (must come after specific routes)
router.route('/:id')
  .get(optionalAuth, getAttribute)
  .put(protect, updateAttribute)
  .delete(protect, deleteAttribute);

router.patch('/:id/toggle-offline', protect, toggleAttributeOffline);

module.exports = router; 
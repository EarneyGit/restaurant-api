const express = require('express');
const {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole
} = require('../controllers/role.controller');

const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all routes
router.use(protect);

// Role management routes - admin only
router
  .route('/')
  .get(admin, getRoles)
  .post(admin, createRole);

router
  .route('/:id')
  .get(admin, getRole)
  .put(admin, updateRole)
  .delete(admin, deleteRole);

module.exports = router; 
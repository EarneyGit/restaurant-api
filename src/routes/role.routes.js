const express = require('express');
const {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole
} = require('../controllers/role.controller');

const router = express.Router();

// All routes are now public
router
  .route('/')
  .get(getRoles)
  .post(createRole);

router
  .route('/:id')
  .get(getRole)
  .put(updateRole)
  .delete(deleteRole);

module.exports = router; 
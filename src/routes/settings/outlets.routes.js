const express = require('express');
const {
  getBranches,
  getBranch,
  updateBranch
} = require('../../controllers/branch.controller');

const { protect } = require('../../middleware/auth.middleware');

const router = express.Router();

// Outlets Routes (using branch controller)
router.route('/')
  .get(protect, getBranches);

router.route('/:id')
  .get(protect, getBranch)
  .put(protect, updateBranch);

module.exports = router; 
const express = require('express');
const {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchesInRadius
} = require('../controllers/branch.controller');

const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Get branches in radius
router.route('/radius/:zipcode/:distance')
  .get(getBranchesInRadius);

// Get all branches and create new branch
router.route('/')
  .get(getBranches)
  .post(protect, admin, createBranch);

// Get, update and delete branch
router.route('/:id')
  .get(getBranch)
  .put(protect, admin, updateBranch)
  .delete(protect, admin, deleteBranch);

module.exports = router; 
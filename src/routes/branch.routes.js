const express = require('express');
const {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchesInRadius,
  updateBranchSettings
} = require('../controllers/branch.controller');

const { protect, admin, manager } = require('../middleware/auth.middleware');

const router = express.Router();

// Get branches in radius
router.route('/radius/:zipcode/:distance')
  .get(getBranchesInRadius);

// Public routes (accessible to all)
router.get('/', getBranches);
router.get('/:id', getBranch);

// Protected routes (require authentication and proper role)
router.post('/', protect, admin, createBranch); // Only Admin can create
router.put('/:id', protect, manager, updateBranch); // Manager and Admin can update
router.delete('/:id', protect, admin, deleteBranch); // Only Admin can delete

// Update branch settings
router.route('/:id/settings')
  .patch(protect, admin, updateBranchSettings);

module.exports = router; 
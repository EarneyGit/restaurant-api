const express = require('express');
const {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchesInRadius,
  updateBranchSettings,
  getOutletSettings,
  updateOutletDetails,
  updateOutletLocation,
  updateOutletOrderingOptions,
  updateOutletPreOrdering
} = require('../controllers/branch.controller');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes - for branch selection
router.get('/', getBranches); // Public for branch selection
router.get('/radius/:zipcode/:distance', getBranchesInRadius); // Public for location-based search

// Protected routes - use admin's branch from token, no :id needed
router.get('/my-branch', protect, getBranch); // Get user's assigned branch
router.post('/', protect, createBranch); // Create new branch (admin/manager/staff)
router.put('/my-branch', protect, updateBranch); // Update user's branch (admin/manager/staff)
router.delete('/my-branch', protect, deleteBranch); // Delete user's branch (admin/manager/staff)

// Branch settings routes - use user's branch from token
router.patch('/settings', protect, updateBranchSettings); // Update user's branch settings (admin/manager/staff)

// Outlet-specific settings routes - use user's branch from token
router.get('/outlet-settings', protect, getOutletSettings); // Get user's branch outlet settings (admin/manager/staff)
router.put('/outlet-details', protect, updateOutletDetails); // Update user's branch details (admin/manager/staff)
router.put('/outlet-location', protect, updateOutletLocation); // Update user's branch location (admin/manager/staff)
router.put('/outlet-ordering-options', protect, updateOutletOrderingOptions); // Update user's branch ordering options (admin/manager/staff)
router.put('/outlet-pre-ordering', protect, updateOutletPreOrdering); // Update user's branch pre-ordering (admin/manager/staff)

module.exports = router; 
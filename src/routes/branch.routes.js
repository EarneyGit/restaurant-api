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
  updateOutletPreOrdering,
  getPublicOutletSettings
} = require('../controllers/branch.controller');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.get('/', getBranches);
router.get('/radius/:zipcode/:distance', getBranchesInRadius);

// Public outlet settings routes
router.get('/public-outlet-settings', getPublicOutletSettings); // Get all active outlets
router.get('/public-outlet-settings/:branchId', getPublicOutletSettings); // Get specific outlet

// Protected routes
router.get('/my-branch', protect, getBranch);
router.post('/', protect, createBranch);
router.put('/my-branch', protect, updateBranch);
router.delete('/my-branch', protect, deleteBranch);
router.patch('/settings', protect, updateBranchSettings);

// Outlet settings routes
router.get('/outlet-settings', protect, getOutletSettings);
router.put('/outlet-details', protect, updateOutletDetails);
router.put('/outlet-location', protect, updateOutletLocation);
router.put('/outlet-ordering-options', protect, updateOutletOrderingOptions);
router.put('/outlet-pre-ordering', protect, updateOutletPreOrdering);

module.exports = router; 
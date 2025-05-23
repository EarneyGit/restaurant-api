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

const router = express.Router();

// All routes are now public
router.route('/radius/:zipcode/:distance')
  .get(getBranchesInRadius);

router.get('/', getBranches);
router.get('/:id', getBranch);
router.post('/', createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

router.route('/:id/settings')
  .patch(updateBranchSettings);

// Outlet-specific settings routes
router.get('/:id/outlet-settings', getOutletSettings);
router.put('/:id/outlet-details', updateOutletDetails);
router.put('/:id/outlet-location', updateOutletLocation);
router.put('/:id/outlet-ordering-options', updateOutletOrderingOptions);
router.put('/:id/outlet-pre-ordering', updateOutletPreOrdering);

module.exports = router; 
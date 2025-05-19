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

module.exports = router; 
const express = require('express');
const {
  getLeadTimes,
  updateLeadTimes
} = require('../controllers/lead-times.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Lead times routes
router.route('/')
  .get(getLeadTimes)
  .put(updateLeadTimes);

module.exports = router; 
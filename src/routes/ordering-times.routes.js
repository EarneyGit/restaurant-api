const express = require('express');
const {
  getOrderingTimes,
  updateWeeklySchedule,
  updateDaySchedule,
  getClosedDates,
  addClosedDate,
  deleteClosedDate,
  deleteAllClosedDates,
  getOrderRestrictions,
  updateOrderRestrictions,
  checkOrderingAvailability
} = require('../controllers/ordering-times.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Public route for checking availability
router.post('/:branchId/check-availability', checkOrderingAvailability);

// Apply authentication middleware to all routes below
router.use(protect);

// Main ordering times routes
router.get('/:branchId', getOrderingTimes);
router.put('/:branchId/weekly-schedule', updateWeeklySchedule);
router.put('/:branchId/day/:dayName', updateDaySchedule);

// Closed dates management
router.get('/:branchId/closed-dates', getClosedDates);
router.post('/:branchId/closed-dates', addClosedDate);
router.delete('/:branchId/closed-dates/:closedDateId', deleteClosedDate);
router.delete('/:branchId/closed-dates', deleteAllClosedDates);

// Order restrictions management
router.get('/:branchId/restrictions', getOrderRestrictions);
router.put('/:branchId/restrictions', updateOrderRestrictions);

module.exports = router; 
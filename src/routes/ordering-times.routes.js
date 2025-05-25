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

// Public route for checking availability (before auth middleware)
router.post('/:branchId/check-availability', checkOrderingAvailability);

// Apply authentication middleware to all routes below
router.use(protect);

// SPECIFIC ROUTES MUST COME BEFORE PARAMETERIZED ROUTES
// Main ordering times routes for admin users (no branchId needed)
router.get('/', getOrderingTimes);
router.put('/weekly-schedule', updateWeeklySchedule);
router.put('/day/:dayName', updateDaySchedule);

// Closed dates management for admin users (no branchId needed)
router.get('/closed-dates', getClosedDates);
router.post('/closed-dates', addClosedDate);
router.delete('/closed-dates/:closedDateId', deleteClosedDate);
router.delete('/closed-dates', deleteAllClosedDates);

// Order restrictions management for admin users (no branchId needed)
router.get('/restrictions', getOrderRestrictions);
router.put('/restrictions', updateOrderRestrictions);

// PARAMETERIZED ROUTES COME LAST
// Main ordering times routes for specific branch access
router.get('/:branchId', getOrderingTimes);
router.put('/:branchId/weekly-schedule', updateWeeklySchedule);
router.put('/:branchId/day/:dayName', updateDaySchedule);

// Closed dates management for specific branch access
router.get('/:branchId/closed-dates', getClosedDates);
router.post('/:branchId/closed-dates', addClosedDate);
router.delete('/:branchId/closed-dates/:closedDateId', deleteClosedDate);
router.delete('/:branchId/closed-dates', deleteAllClosedDates);

// Order restrictions management for specific branch access
router.get('/:branchId/restrictions', getOrderRestrictions);
router.put('/:branchId/restrictions', updateOrderRestrictions);

module.exports = router; 
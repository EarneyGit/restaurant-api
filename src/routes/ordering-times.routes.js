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

// Main ordering times routes - admin users don't need branchId in URL
router.get('/', getOrderingTimes); // For admin users, gets their branch
router.get('/:branchId', getOrderingTimes); // For specific branch access
router.put('/weekly-schedule', updateWeeklySchedule); // For admin users
router.put('/:branchId/weekly-schedule', updateWeeklySchedule); // For specific branch
router.put('/day/:dayName', updateDaySchedule); // For admin users
router.put('/:branchId/day/:dayName', updateDaySchedule); // For specific branch

// Closed dates management - admin users don't need branchId in URL
router.get('/closed-dates', getClosedDates); // For admin users
router.get('/:branchId/closed-dates', getClosedDates); // For specific branch
router.post('/closed-dates', addClosedDate); // For admin users
router.post('/:branchId/closed-dates', addClosedDate); // For specific branch
router.delete('/closed-dates/:closedDateId', deleteClosedDate); // For admin users
router.delete('/:branchId/closed-dates/:closedDateId', deleteClosedDate); // For specific branch
router.delete('/closed-dates', deleteAllClosedDates); // For admin users
router.delete('/:branchId/closed-dates', deleteAllClosedDates); // For specific branch

// Order restrictions management - admin users don't need branchId in URL
router.get('/restrictions', getOrderRestrictions); // For admin users
router.get('/:branchId/restrictions', getOrderRestrictions); // For specific branch
router.put('/restrictions', updateOrderRestrictions); // For admin users
router.put('/:branchId/restrictions', updateOrderRestrictions); // For specific branch

module.exports = router; 
const express = require('express');
const {
  getReservations,
  getReservation,
  createReservation,
  updateReservationStatus,
  cancelReservation,
  getMyReservations
} = require('../controllers/reservation.controller');

const { protect, admin, manager } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Get my reservations
router.get('/myreservations', getMyReservations);

// Get all reservations
router.route('/')
  .get(getReservations)
  .post(createReservation);

// Get and update reservation
router.route('/:id')
  .get(getReservation);

// Update reservation status
router.route('/:id/status')
  .put(manager, updateReservationStatus);

// Cancel reservation
router.route('/:id/cancel')
  .put(cancelReservation);

module.exports = router; 
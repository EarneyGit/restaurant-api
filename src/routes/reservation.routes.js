const express = require('express');
const {
  getReservations,
  getReservation,
  createReservation,
  updateReservationStatus,
  cancelReservation,
  getMyReservations
} = require('../controllers/reservation.controller');

const router = express.Router();// All routes are now public
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
  .put(updateReservationStatus);

// Cancel reservation
router.route('/:id/cancel')
  .put(cancelReservation);

module.exports = router; 
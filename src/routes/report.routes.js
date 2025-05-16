const express = require('express');
const {
  getSalesReport,
  getTopProducts,
  getCustomerStats,
  getReservationStats
} = require('../controllers/report.controller');

const { protect, admin, manager } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Sales reports (admin/manager only)
router.get('/sales', manager, getSalesReport);

// Product reports (admin/manager only)
router.get('/products/top', manager, getTopProducts);

// Customer reports (admin only)
router.get('/customers', admin, getCustomerStats);

// Reservation reports (admin/manager only)
router.get('/reservations', manager, getReservationStats);

module.exports = router; 
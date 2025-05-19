const express = require('express');
const {
  getSalesReport,
  getTopProducts,
  getCustomerStats,
  getReservationStats
} = require('../controllers/report.controller');

const router = express.Router();

// All routes are now public
router.get('/sales', getSalesReport);
router.get('/products/top', getTopProducts);
router.get('/customers', getCustomerStats);
router.get('/reservations', getReservationStats);

module.exports = router; 
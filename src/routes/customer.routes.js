const express = require('express');
const {
  getCustomers,
  getCustomer,
  getCustomerStats
} = require('../controllers/customer.controller');

// Import authentication middleware
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication and admin privileges
router.use(protect);
router.use(admin);

// Customer routes
router.get('/', getCustomers);
router.get('/stats', getCustomerStats);
router.get('/:id', getCustomer);

module.exports = router; 
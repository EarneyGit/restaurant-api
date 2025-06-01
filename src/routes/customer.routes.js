const express = require('express');
const {
  getCustomers,
  getCustomer,
  getCustomerStats,
  updateCustomer,
  getCustomersList
} = require('../controllers/customer.controller');

// Import authentication middleware
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Customer routes
router.get('/', protect, admin, getCustomers); // Deprecated - keeping for backward compatibility
router.post('/list', getCustomersList); // Public - no auth needed
router.get('/stats', protect, admin, getCustomerStats); // Protected
router.get('/:id', getCustomer); // Public - no auth needed for customer details
router.put('/:id', protect, admin, updateCustomer); // Protected

module.exports = router; 
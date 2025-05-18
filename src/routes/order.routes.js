const express = require('express');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  getMyOrders,
  getTodayOrders
} = require('../controllers/order.controller');

const { protect, admin, manager, staff } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Define specific routes first (before parameter routes)
// Get my orders - accessible by all authenticated users
router.get('/myorders', getMyOrders);

// Get today's orders - accessible by admin, manager, staff
router.get('/today', staff, getTodayOrders);

// Get all orders
router.get('/', getOrders);

// Create order - accessible by all authenticated users
router.post('/', createOrder);

// Get single order
router.get('/:id', getOrder);

// Update order - accessible by staff, manager, admin
router.put('/:id', staff, updateOrder);

// Delete order - accessible by manager, admin only
router.delete('/:id', manager, deleteOrder);

module.exports = router; 
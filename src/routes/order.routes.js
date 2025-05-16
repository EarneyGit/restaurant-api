const express = require('express');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getMyOrders
} = require('../controllers/order.controller');

const { protect, admin, manager } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Get my orders
router.get('/myorders', getMyOrders);

// Get all orders (admin/manager only)
router.route('/')
  .get(getOrders)
  .post(createOrder);

// Get, update order status and update payment status
router.route('/:id')
  .get(getOrder);

router.route('/:id/status')
  .put(updateOrderStatus);

router.route('/:id/payment')
  .put(manager, updatePaymentStatus);

module.exports = router; 
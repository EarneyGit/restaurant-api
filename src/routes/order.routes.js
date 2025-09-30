const express = require('express');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  getMyOrders,
  getTodayOrders,
  checkPaymentStatus,
  stripeWebhook,
  cancelPayment,
  getCustomerOrders
} = require('../controllers/order.controller');

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Mixed access routes - support both authenticated and unauthenticated users
router.get('/myorders', protect, getMyOrders); // Requires authentication
router.get('/today', protect, getTodayOrders); // Admin only
router.post('/', optionalAuth, createOrder); // Public with optional auth
// router.get('/', protect, getOrders); // Auth required to ensure branch scoping
// router.get('/:id', protect, getOrder); // Auth required to ensure branch scoping

router.get('/', optionalAuth, getOrders); // Public with optional auth
router.get('/:id', optionalAuth, getOrder); // Public with optional auth

// Payment-related routes
router.post('/check-payment-status', optionalAuth, checkPaymentStatus); // Public with optional auth
router.post('/stripe-webhook', stripeWebhook); // Public - Stripe webhook
router.post('/cancel-payment/:paymentIntentId', optionalAuth, cancelPayment); // Public/Private (Order owner or admin)

// Admin-only routes - allow admin, manager, staff
router.put('/:id', protect, updateOrder); // Admin/Manager/Staff only
router.delete('/:id', protect, deleteOrder); // Admin/Manager/Staff only
router.get('/customer/:customerId', protect, getCustomerOrders); // Admin/Manager/Staff only

module.exports = router; 
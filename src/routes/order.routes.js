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

// Import authentication middleware
const { protect, admin, optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Mixed access routes - support both authenticated and unauthenticated users
router.get('/myorders', protect, getMyOrders); // Requires authentication
router.get('/today', protect, getTodayOrders); // Admin only
router.post('/', optionalAuth, createOrder); // Public with optional auth
router.get('/', optionalAuth, getOrders); // Public with optional auth
router.get('/:id', optionalAuth, getOrder); // Public with optional auth

// Admin-only routes - allow admin, manager, staff
router.put('/:id', protect, updateOrder); // Admin/Manager/Staff only
router.delete('/:id', protect, deleteOrder); // Admin/Manager/Staff only

module.exports = router; 
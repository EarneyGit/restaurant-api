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

const router = express.Router();

// All routes are now public
router.get('/myorders', getMyOrders);
router.get('/today', getTodayOrders);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);
router.get('/', getOrders);
router.get('/:id', getOrder);

module.exports = router; 
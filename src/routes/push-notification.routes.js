const express = require('express');
const {
  getPushNotifications,
  getPushNotification,
  createPushNotification,
  updatePushNotification,
  deletePushNotification,
  getNotificationStats
} = require('../controllers/push-notification.controller');

// Import authentication middleware
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Special routes that must come before parameterized routes
router.get('/stats', getNotificationStats);

// Main CRUD routes
router.route('/')
  .get(getPushNotifications)
  .post(createPushNotification);

// Parameterized routes (must come after specific routes)
router.route('/:id')
  .get(getPushNotification)
  .put(updatePushNotification)
  .delete(deletePushNotification);

module.exports = router; 
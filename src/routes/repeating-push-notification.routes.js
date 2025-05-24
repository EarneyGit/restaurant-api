const express = require('express');
const {
  getRepeatingPushNotifications,
  getRepeatingPushNotification,
  createRepeatingPushNotification,
  updateRepeatingPushNotification,
  deleteRepeatingPushNotification,
  toggleRepeatingPushNotificationStatus,
  getRepeatingNotificationStats
} = require('../controllers/repeating-push-notification.controller');

// Import authentication middleware
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Special routes that must come before parameterized routes
router.get('/stats', getRepeatingNotificationStats);

// Main CRUD routes
router.route('/')
  .get(getRepeatingPushNotifications)
  .post(createRepeatingPushNotification);

// Parameterized routes (must come after specific routes)
router.route('/:id')
  .get(getRepeatingPushNotification)
  .put(updateRepeatingPushNotification)
  .delete(deleteRepeatingPushNotification);

// Toggle status route
router.patch('/:id/toggle-status', toggleRepeatingPushNotificationStatus);

module.exports = router; 
const express = require('express');
const {
  getSmsEmailMessages,
  getSmsEmailMessage,
  createSmsEmailMessage,
  updateSmsEmailMessage,
  deleteSmsEmailMessage,
  getSmsEmailMessageStats
} = require('../controllers/sms-email-message.controller');

// Import authentication middleware
const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Special routes that must come before parameterized routes
router.get('/stats', getSmsEmailMessageStats);

// Main CRUD routes
router.route('/')
  .get(getSmsEmailMessages)
  .post(createSmsEmailMessage);

// Parameterized routes (must come after specific routes)
router.route('/:id')
  .get(getSmsEmailMessage)
  .put(updateSmsEmailMessage)
  .delete(deleteSmsEmailMessage);

module.exports = router; 
const express = require('express');
const router = express.Router();
const { updateProfile } = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth.middleware');

// Update user profile - Protected route
router.put('/update', protect, updateProfile);

module.exports = router; 
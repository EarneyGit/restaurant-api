const express = require('express');
const { 
  sendOtp,
  verifyOtp, 
  register, 
  forgotPasswordOtp,
  resetPassword,
  login, 
  getMe, 
  logout,
  verifyToken
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Registration Routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);

// Authentication Routes
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

// Verify Token Route
router.get('/verify-token', protect, verifyToken);

// Password Reset Routes
router.post('/forgot-password-otp', forgotPasswordOtp);
router.post('/reset-password', resetPassword);

module.exports = router; 
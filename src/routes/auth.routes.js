const express = require('express');
const { 
  registerInit, 
  registerComplete, 
  login, 
  getMe, 
  logout,
  forgotPassword,
  verifyResetOTP,
  resetPassword
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Registration Routes
router.post('/register-init', registerInit);
router.post('/register-complete', registerComplete);

// Authentication Routes
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

// Password Reset Routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password/:resetToken', resetPassword);

module.exports = router; 
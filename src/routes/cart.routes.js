const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  updateCartDelivery,
  mergeCart,
  getCartSummary
} = require('../controllers/cart.controller');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_api_secret_key';

// Optional authentication middleware - attaches user if token is valid, but doesn't require it
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    
    if (token && token.startsWith('Bearer ')) {
      token = token.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (user) {
          req.user = user;
        }
      } catch (error) {
        // Invalid token, but we continue without user
        console.log('Invalid token in optional auth:', error.message);
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Required authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    
    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    token = token.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token.'
    });
  }
};

// Get user's cart
router.get('/', optionalAuth, getCart);

// Get cart summary (lightweight)
router.get('/summary', optionalAuth, getCartSummary);

// Add item to cart
router.post('/items', optionalAuth, addToCart);

// Update cart item (quantity or special requirements)
router.put('/items/:itemId', optionalAuth, updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', optionalAuth, removeFromCart);

// Clear entire cart
router.delete('/', optionalAuth, clearCart);

// Update cart delivery settings
router.put('/delivery', optionalAuth, updateCartDelivery);

// Merge guest cart with user cart (requires authentication)
router.post('/merge', requireAuth, mergeCart);

module.exports = router; 
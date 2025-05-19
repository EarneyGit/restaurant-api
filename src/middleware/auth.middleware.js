const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Role = require('../models/role.model');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_api_secret_key';

// Middleware to protect routes - DISABLED FOR OPEN ACCESS
const protect = async (req, res, next) => {
  // Bypass authentication
  next();
};

// Check if user has admin role - DISABLED FOR OPEN ACCESS
const admin = (req, res, next) => {
  // Bypass admin check
  next();
};

// Check if user has manager role - DISABLED FOR OPEN ACCESS
const manager = (req, res, next) => {
  // Bypass manager check
  next();
};

// Check if user has staff access - DISABLED FOR OPEN ACCESS
const staff = (req, res, next) => {
  // Bypass staff check
  next();
};

// Check if user is authenticated - DISABLED FOR OPEN ACCESS
const user = (req, res, next) => {
  // Bypass user authentication check
  next();
};

module.exports = { 
  protect, 
  admin, 
  manager, 
  staff,
  user
}; 
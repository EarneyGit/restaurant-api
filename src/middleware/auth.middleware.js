const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Role = require('../models/role.model');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_api_secret_key';

// Middleware to protect routes
const protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id)
        .select('-password')
        .populate('roleId', 'name slug isActive');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user's role is active
      if (user.roleId && !user.roleId.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account role has been disabled'
        });
      }

      // Assign user to request
      req.user = user;
      
      // Add token's role information to request for easier access in route handlers
      if (decoded.role) {
        req.tokenRole = decoded.role;
      }

      next();
    } catch (error) {
      console.error('Token verification error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Check if user has admin role
const admin = (req, res, next) => {
  // Always check roleId from the user object, not from the token
  if (req.user && req.user.roleId && req.user.roleId.slug === 'admin') {
    next();
  } else {
    console.log('Admin access denied. User roleId:', req.user?.roleId);
    return res.status(403).json({
      success: false,
      message: 'Not authorized'
    });
  }
};

// Check if user has manager role (or is an admin)
const manager = (req, res, next) => {
  // Always check roleId from the user object, not from the token
  if (req.user && req.user.roleId && 
      (req.user.roleId.slug === 'admin' || req.user.roleId.slug === 'manager')) {
    next();
  } else {
    console.log('Manager access denied. User roleId:', req.user?.roleId);
    return res.status(403).json({
      success: false,
      message: 'Not authorized as a manager'
    });
  }
};

// Check if user has staff access (admin, manager, or staff)
const staff = (req, res, next) => {
  // Always check roleId from the user object, not from the token
  if (req.user && req.user.roleId && (
      req.user.roleId.slug === 'admin' || 
      req.user.roleId.slug === 'manager' || 
      req.user.roleId.slug === 'staff'
  )) {
    next();
  } else {
    console.log('Staff access denied. User roleId:', req.user?.roleId);
    return res.status(403).json({
      success: false,
      message: 'Not authorized as staff'
    });
  }
};

// Check if user is authenticated (can be any role including null roleId as regular user)
const user = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Authentication required'
    });
  }
};

module.exports = { 
  protect, 
  admin, 
  manager, 
  staff,
  user
}; 
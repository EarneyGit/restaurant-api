const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Token = require('../models/token.model');
const Role = require('../models/role.model');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_api_secret_key';

// Middleware to protect routes
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Check if token exists in database and is valid
      const tokenRecord = await Token.findOne({
        token,
        type: 'login',
        purpose: 'login',
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (!tokenRecord) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Invalid or expired token.'
        });
      }

      // Get user details
      const user = await User.findById(decoded.id)
        .populate('roleId', 'name slug permissions')
        .populate('branchId', 'name');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. User not found.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Account is deactivated.'
        });
      }

      // Add user to request object
      req.user = {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.roleId ? user.roleId.slug : 'user',
        roleId: user.roleId,
        branchId: user.branchId ? user.branchId._id : null,
        permissions: user.roleId ? user.roleId.permissions : []
      };

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication.'
    });
  }
};

// Check if user has superadmin role
const superadmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin role required.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in role check.'
    });
  }
};

// Check if user has admin role
const admin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    // Allow both superadmin and admin
    const allowedRoles = ['superadmin', 'admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role or higher required.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in role check.'
    });
  }
};

// Check if user has manager role or higher
const manager = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    const allowedRoles = ['superadmin', 'admin', 'manager'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Manager role or higher required.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in role check.'
    });
  }
};

// Check if user has staff access or higher
const staff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    const allowedRoles = ['superadmin', 'admin', 'manager', 'staff'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Staff role or higher required.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in role check.'
    });
  }
};

// Check if user is authenticated (any role)
const user = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication check.'
    });
  }
};

// Optional authentication middleware - allows both authenticated and unauthenticated access
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    // Check for token in authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token, continue without authentication
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Check if token exists in database and is valid
      const tokenRecord = await Token.findOne({
        token,
        type: 'login',
        purpose: 'login',
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (!tokenRecord) {
        // Invalid token, continue without authentication
        req.user = null;
        return next();
      }

      // Get user details
      const user = await User.findById(decoded.id)
        .populate('roleId', 'name slug permissions')
        .populate('branchId', 'name');

      if (!user || !user.isActive) {
        // User not found or inactive, continue without authentication
        req.user = null;
        return next();
      }

      // Add user to request object
      req.user = {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.roleId ? user.roleId.slug : 'user',
        roleId: user.roleId,
        branchId: user.branchId ? user.branchId._id : null,
        permissions: user.roleId ? user.roleId.permissions : []
      };

      next();
    } catch (error) {
      // Token verification failed, continue without authentication
      req.user = null;
      next();
    }
  } catch (error) {
    // Server error, continue without authentication
    req.user = null;
    next();
  }
};

module.exports = { 
  protect, 
  superadmin,
  admin, 
  manager, 
  staff,
  user,
  optionalAuth
}; 
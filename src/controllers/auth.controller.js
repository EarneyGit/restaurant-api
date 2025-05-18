const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import models
const User = require('../models/user.model');
const Branch = require('../models/branch.model');
// Don't import Role directly to avoid circular deps

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    console.log('Registration attempt:', req.body);
    const { name, email, password, phone, address, roleId } = req.body;

    // Basic validations
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    // Check if user already exists - using User model
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // If roleId is provided and not for a normal user, find the role
    let userRole = null;
    if (roleId) {
      // Find the role - using mongoose.model to avoid circular deps
      const Role = mongoose.model('Role');
      userRole = await Role.findById(roleId);
      
      if (!userRole) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID provided'
        });
      }
      
      console.log('Found user role:', userRole);
    }

    // Create user using the model
    const userData = {
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by the model's pre-save hook
      roleId: userRole ? userRole._id : null, // Set roleId to null for normal users
      phone: phone || '',
      address: address || '',
      profileImage: 'default-avatar.jpg',
      isActive: true
    };

    // Create and save the user
    const user = new User(userData);
    await user.save({ validateBeforeSave: true });
    
    console.log('User created:', user._id);
    
    // Generate token - now async
    const token = await user.getSignedJwtToken();

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: userRole ? userRole.slug : 'user'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    // Check for user and include role details if present
    const user = await User.findOne({ email })
      .select('+password')
      .populate('roleId', 'name slug isActive');

    // Debug logging for user lookup
    console.log('Login attempt for:', email);
    if (!user) {
      console.log('User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('User found:', {
      id: user._id,
      roleId: user.roleId,
      passwordExists: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    });
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }
    
    // Check if role is active (only if roleId exists)
    if (user.roleId && !user.roleId.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account role has been disabled'
      });
    }

    // Check if password matches
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      console.log('Password match result:', isMatch);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials - password mismatch'
        });
      }
    } catch (err) {
      console.error('Error comparing passwords:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Error validating credentials'
      });
    }
    
    // Update last login time
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Generate token - now async
    const token = await user.getSignedJwtToken();
    
    // If user is staff/manager, fetch branch details
    let branchDetails = null;
    const roleSlug = user.roleId ? user.roleId.slug : 'user';
    if (['staff', 'manager'].includes(roleSlug) && user.branchId) {
      branchDetails = await Branch.findById(user.branchId).select('name address');
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: roleSlug,
        roleDetails: user.roleId ? {
          id: user.roleId._id,
          name: user.roleId.name,
          slug: user.roleId.slug
        } : null,
        branchId: user.branchId,
        branch: branchDetails
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('branchId', 'name address')
      .populate('roleId', 'name slug');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Successfully logged out'
    });
  } catch (error) {
    next(error);
  }
}; 
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import models
const User = require('../models/user.model');
const OTP = require('../models/otp.model');
const Token = require('../models/token.model');
const Branch = require('../models/branch.model');
// Don't import Role directly to avoid circular deps

// Import email utility
const { generateOTP, sendVerificationOTP, sendPasswordResetOTP } = require('../utils/emailSender');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_api_secret_key';

// Helper function to generate JWT token
const generateJWTToken = (payload, expiresIn = '10m') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// @desc    Send OTP for registration
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate OTP
    const otp = generateOTP(6);

    // Delete any existing OTPs for this email and purpose
    await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'registration' });

    // Save OTP to database
    await OTP.create({
      email: email.toLowerCase(),
      otp,
      purpose: 'registration',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // Send OTP via email
    await sendVerificationOTP(email.toLowerCase(), otp, 'User');

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email successfully'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    next(error);
  }
};

// @desc    Verify OTP and generate temporary token
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and OTP'
      });
    }

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as used
    otpRecord.used = true;
    await otpRecord.save();

    // Generate temporary JWT token
    const temporaryToken = generateJWTToken(
      { email: email.toLowerCase(), purpose: otpRecord.purpose },
      '10m'
    );

    // Delete any existing temporary tokens for this email and purpose
    await Token.deleteMany({ 
      email: email.toLowerCase(), 
      type: 'temporary', 
      purpose: otpRecord.purpose 
    });

    // Save temporary token to database
    await Token.create({
      token: temporaryToken,
      email: email.toLowerCase(),
      type: 'temporary',
      purpose: otpRecord.purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      token: temporaryToken
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    next(error);
  }
};

// @desc    Complete user registration
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { email, token, password, phone, name, address, roleId } = req.body;

    if (!email || !token || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, token, password, and name'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Verify temporary token
    const tokenRecord = await Token.findOne({
      token,
      email: email.toLowerCase(),
      type: 'temporary',
      purpose: 'registration',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Check if user already exists (double check)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // If roleId is provided, validate it
    let userRole = null;
    if (roleId) {
      const Role = mongoose.model('Role');
      userRole = await Role.findById(roleId);
      if (!userRole) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID provided'
        });
      }
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      address,
      roleId: userRole ? userRole._id : null,
      emailVerified: true,
      isActive: true
    });

    // Mark temporary token as used
    tokenRecord.used = true;
    await tokenRecord.save();

    // Generate login token
    const loginToken = generateJWTToken(
      { 
        id: user._id,
        email: user.email,
        role: userRole ? userRole.slug : 'user'
      },
      '24h'
    );

    // Save login token
    await Token.create({
      token: loginToken,
      email: user.email,
      userId: user._id,
      type: 'login',
      purpose: 'login',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token: loginToken,
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

// @desc    Send OTP for forgot password
// @route   POST /api/auth/forgot-password-otp
// @access  Public
exports.forgotPasswordOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    // Generate OTP
    const otp = generateOTP(6);

    // Delete any existing OTPs for this email and purpose
    await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'forgot-password' });

    // Save OTP to database
    await OTP.create({
      email: email.toLowerCase(),
      otp,
      purpose: 'forgot-password',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // Send OTP via email
    await sendPasswordResetOTP(email.toLowerCase(), otp, user.name);

    res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email'
    });
  } catch (error) {
    console.error('Forgot password OTP error:', error);
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { password, confirmPassword, token } = req.body;

    if (!password || !confirmPassword || !token) {
      return res.status(400).json({
        success: false,
        message: 'Please provide password, confirm password, and token'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Verify temporary token
    const tokenRecord = await Token.findOne({
      token,
      type: 'temporary',
      purpose: 'forgot-password',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Find user
    const user = await User.findOne({ email: tokenRecord.email });

    // Update password
    user.password = password;
    await user.save();

    // Mark token as used
    tokenRecord.used = true;
    await tokenRecord.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('roleId', 'name slug permissions')
      .populate('branchId', 'name address');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate login token
    const loginToken = generateJWTToken(
      { 
        id: user._id,
        email: user.email,
        role: user.roleId ? user.roleId.slug : 'user',
        branchId: user.branchId ? user.branchId._id : null
      },
      '24h'
    );

    // Delete any existing login tokens for this user
    await Token.deleteMany({ 
      userId: user._id, 
      type: 'login', 
      purpose: 'login' 
    });

    // Save login token
    await Token.create({
      token: loginToken,
      email: user.email,
      userId: user._id,
      type: 'login',
      purpose: 'login',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: loginToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.roleId ? user.roleId.slug : 'user',
        roleDetails: user.roleId ? {
          id: user.roleId._id,
          name: user.roleId.name,
          slug: user.roleId.slug
        } : null,
        branchId: user.branchId ? user.branchId._id : null,
        branch: user.branchId ? {
          id: user.branchId._id,
          name: user.branchId.name,
          address: user.branchId.address
        } : null,
        permissions: user.roleId ? user.roleId.permissions : []
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('roleId', 'name slug permissions')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.roleId ? user.roleId.slug : 'user',
        permissions: user.roleId ? user.roleId.permissions : [],
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    next(error);
  }
};

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Mark token as used (effectively invalidating it)
      await Token.findOneAndUpdate(
        { token, used: false },
        { used: true }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    next(error);
  }
};

// @desc    Verify login token
// @route   GET /api/auth/verify-token
// @access  Private
exports.verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required',
      });
    }
    const token = authHeader.split(' ')[1];

    // Verify token exists in Token collection and is valid
    const tokenDoc = await Token.findOne({
      token,
      type: 'login',
      used: false,
      expiresAt: { $gt: new Date() },
    });
    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Decode token to get userId
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Get user
    const user = await User.findById(decoded.id)
      .populate('roleId', 'name slug permissions')
      .populate('branchId', 'name address');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Return user info (similar to login response)
    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.roleId ? user.roleId.slug : 'user',
        roleDetails: user.roleId ? {
          id: user.roleId._id,
          name: user.roleId.name,
          slug: user.roleId.slug
        } : null,
        branchId: user.branchId ? user.branchId._id : null,
        branch: user.branchId ? {
          id: user.branchId._id,
          name: user.branchId.name,
          address: user.branchId.address
        } : null,
        permissions: user.roleId ? user.roleId.permissions : []
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during token verification',
    });
  }
}; 
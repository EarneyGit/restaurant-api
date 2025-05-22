const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import models
const User = require('../models/user.model');
const Branch = require('../models/branch.model');
// Don't import Role directly to avoid circular deps

// Import email utility
const { generateOTP, sendVerificationOTP, sendPasswordResetOTP } = require('../utils/emailSender');

// @desc    Start user registration process by sending OTP
// @route   POST /api/auth/register-init
// @access  Public
exports.registerInit = async (req, res, next) => {
  try {
    console.log('Registration initialization attempt:', req.body);
    const { name, email } = req.body;

    // Basic validations
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and email'
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

    // Generate OTP
    const otp = generateOTP(6);
    const otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create temporary user with OTP
    const tempUser = new User({
      name,
      email: email.toLowerCase(),
      emailVerificationOtp: otp,
      emailVerificationOtpExpire: otpExpire,
      password: crypto.randomBytes(20).toString('hex'), // Temporary password
      isActive: false // User not active until verified
    });

    await tempUser.save({ validateBeforeSave: false });
    
    // Send verification email
    await sendVerificationOTP(email.toLowerCase(), otp, name);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Verification OTP sent to your email'
    });
  } catch (error) {
    console.error('Registration initialization error:', error);
    next(error);
  }
};

// @desc    Complete user registration with OTP verification
// @route   POST /api/auth/register-complete
// @access  Public
exports.registerComplete = async (req, res, next) => {
  try {
    console.log('Registration completion attempt:', req.body);
    const { email, otp, password, phone, address, roleId } = req.body;

    // Basic validations
    if (!email || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, OTP and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find the user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationOtpExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired or user not found'
      });
    }

    // Check if OTP matches
    if (user.emailVerificationOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
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

    // Update user details
    user.password = password;
    user.emailVerified = true;
    user.isActive = true;
    user.emailVerificationOtp = undefined;
    user.emailVerificationOtpExpire = undefined;
    user.roleId = userRole ? userRole._id : null;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();
    
    console.log('User registration completed:', user._id);
    
    // Generate token
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
    console.error('Registration completion error:', error);
    next(error);
  }
};

// @desc    Request password reset by sending OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if email provided
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Return success even if no user found (security)
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email'
      });
    }

    // Generate OTP
    const otp = generateOTP(6);
    const otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save OTP to user
    user.passwordResetOtp = otp;
    user.passwordResetOtpExpire = otpExpire;
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    await sendPasswordResetOTP(email.toLowerCase(), otp);

    // Return success
    res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    next(error);
  }
};

// @desc    Verify OTP and issue temporary token
// @route   POST /api/auth/verify-reset-otp
// @access  Public
exports.verifyResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Check if email and OTP provided
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and OTP'
      });
    }

    // Find user by email and valid OTP
    const user = await User.findOne({
      email: email.toLowerCase(),
      passwordResetOtp: otp,
      passwordResetOtpExpire: { $gt: Date.now() }
    });

    // Return error if user not found or OTP invalid
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Generate temporary reset token (5 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    // Clear OTP data
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpire = undefined;
    
    await user.save({ validateBeforeSave: false });

    // Return the reset token
    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      resetToken
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    next(error);
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { password, confirmPassword } = req.body;
    const { resetToken } = req.params;

    // Check if passwords match
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide password and confirm password'
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

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Find user by token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
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
    
    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in'
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
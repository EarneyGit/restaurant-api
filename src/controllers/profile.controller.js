const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Token = require('../models/token.model');

// @desc    Update user profile
// @route   PUT /api/profile/update
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    // Get authorization token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token exists in Token collection
    const tokenDoc = await Token.findOne({
      token,
      type: 'login',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Decode token to get userId
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'restaurant_api_secret_key');

    // Verify token belongs to the correct user
    if (tokenDoc.userId.toString() !== decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Fields that can be updated
    const updatableFields = [
      'firstName',
      'lastName',
      'mobileNumber',
      'address',
      'addressLine1',
      'addressLine2',
      'city',
      'postalCode',
      'emailNotifications',
      'smsNotifications',
      'preferredCommunicationEmail',
      'preferredCommunicationSMS'
    ];

    // Create update object with only allowed fields
    const updateData = {};
    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: updatedUser
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
}; 
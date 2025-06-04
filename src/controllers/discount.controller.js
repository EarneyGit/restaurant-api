const Discount = require('../models/discount.model');
const { MANAGEMENT_ROLES } = require('../constants/roles');
const Order = require('../models/order.model');
const mongoose = require('mongoose');

// @desc    Get all discounts for a branch
// @route   GET /api/discounts
// @access  Private (Admin/Manager/Staff only)
const getDiscounts = async (req, res) => {
  try {
    // Get user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access discounts'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    const { page = 1, limit = 20, isActive } = req.query;
    
    // Build query
    const query = { branchId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Get discounts with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const discounts = await Discount.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Discount.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: discounts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalDiscounts: total,
        hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getDiscounts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get single discount
// @route   GET /api/discounts/:id
// @access  Private (Admin/Manager/Staff only)
const getDiscount = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access discounts'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const discount = await Discount.findOne({
      _id: req.params.id,
      branchId: req.user.branchId
    }).populate('createdBy', 'name email');
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: discount,
      branchId: req.user.branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getDiscount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create new discount
// @route   POST /api/discounts
// @access  Private (Admin/Manager/Staff only)
const createDiscount = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create discounts'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Check if discount code already exists for this branch
    const existingDiscount = await Discount.findOne({
      branchId: req.user.branchId,
      code: req.body.code?.toUpperCase()
    });
    
    if (existingDiscount) {
      return res.status(400).json({
        success: false,
        message: 'Discount code already exists for this branch'
      });
    }
    
    // Process outlets data from frontend
    let outletsData = {};
    if (req.body.outlets && typeof req.body.outlets === 'object') {
      // Convert outlets object to Map format for MongoDB
      outletsData = req.body.outlets;
    }
    
    // Create discount
    const discountData = {
      ...req.body,
      branchId: req.user.branchId,
      createdBy: req.user.id,
      code: req.body.code?.toUpperCase(),
      outlets: outletsData
    };
    
    const discount = await Discount.create(discountData);
    await discount.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: discount,
      message: 'Discount created successfully'
    });
    
  } catch (error) {
    console.error('Error in createDiscount:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Update discount
// @route   PUT /api/discounts/:id
// @access  Private (Admin/Manager/Staff only)
const updateDiscount = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update discounts'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Check if discount code already exists for this branch (excluding current discount)
    if (req.body.code) {
      const existingDiscount = await Discount.findOne({
        branchId: req.user.branchId,
        code: req.body.code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      
      if (existingDiscount) {
        return res.status(400).json({
          success: false,
          message: 'Discount code already exists for this branch'
        });
      }
    }
    
    // Process outlets data from frontend
    let updateData = { ...req.body };
    if (req.body.outlets && typeof req.body.outlets === 'object') {
      // Keep outlets data as is - MongoDB will handle the Map conversion
      updateData.outlets = req.body.outlets;
    }
    
    updateData.code = req.body.code?.toUpperCase();
    
    const discount = await Discount.findOneAndUpdate(
      { _id: req.params.id, branchId: req.user.branchId },
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: discount,
      message: 'Discount updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updateDiscount:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Delete discount
// @route   DELETE /api/discounts/:id
// @access  Private (Admin/Manager/Staff only)
const deleteDiscount = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete discounts'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const discount = await Discount.findOneAndDelete({
      _id: req.params.id,
      branchId: req.user.branchId
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Discount deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in deleteDiscount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Validate discount code
// @route   POST /api/discounts/validate
// @access  Public (for order validation)
const validateDiscountCode = async (req, res) => {
  try {
    const { code, branchId, orderTotal, deliveryMethod, userId } = req.body;
    
    if (!code || !branchId || !orderTotal) {
      return res.status(400).json({
        success: false,
        message: 'Code, branchId, and orderTotal are required'
      });
    }
    
    // Find discount
    const discount = await Discount.findOne({
      code: code.toUpperCase(),
      branchId: branchId,
      isActive: true
    });
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Invalid discount code'
      });
    }
    
    // Create mock order for validation
    const mockOrder = {
      totalAmount: orderTotal,
      deliveryMethod: deliveryMethod
    };
    
    // Validate discount (pass branchId to check availability)
    const validation = discount.isValidForOrder(mockOrder, null, branchId);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason
      });
    }
    
    // Calculate discount
    const discountAmount = discount.calculateDiscount(orderTotal);
    const newTotal = Math.max(0, orderTotal - discountAmount);
    
    res.status(200).json({
      success: true,
      data: {
        discountId: discount._id,
        code: discount.code,
        name: discount.name,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        discountAmount: discountAmount,
        originalTotal: orderTotal,
        newTotal: newTotal,
        savings: discountAmount
      },
      message: 'Discount code is valid'
    });
    
  } catch (error) {
    console.error('Error in validateDiscountCode:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get discount statistics
// @route   GET /api/discounts/stats
// @access  Private (Admin/Manager/Staff only)
const getDiscountStats = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access discount statistics'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    
    // Get discount statistics
    const stats = await Discount.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
      {
        $group: {
          _id: null,
          totalDiscounts: { $sum: 1 },
          activeDiscounts: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          totalUsed: { $sum: '$usageStats.totalUsed' },
          totalSavings: { $sum: '$usageStats.totalSavings' },
          averageDiscountValue: { $avg: '$discountValue' }
        }
      }
    ]);
    
    const discountStats = stats.length > 0 ? stats[0] : {
      totalDiscounts: 0,
      activeDiscounts: 0,
      totalUsed: 0,
      totalSavings: 0,
      averageDiscountValue: 0
    };
    
    // Get most used discounts
    const topDiscounts = await Discount.find({ branchId })
      .sort({ 'usageStats.totalUsed': -1 })
      .limit(5)
      .select('name code usageStats.totalUsed usageStats.totalSavings');
    
    res.status(200).json({
      success: true,
      data: {
        ...discountStats,
        topDiscounts
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getDiscountStats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

module.exports = {
  getDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscountCode,
  getDiscountStats
}; 
const ServiceCharge = require('../models/service-charge.model');
const mongoose = require('mongoose');
const { MANAGEMENT_ROLES } = require('../constants/roles');

// @desc    Get all service charges for a branch
// @route   GET /api/settings/service-charges
// @access  Private (Admin/Manager/Staff only)
const getServiceCharges = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access service charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    const { page = 1, limit = 20, isActive, orderType } = req.query;
    
    // Build query
    const query = { branchId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (orderType) {
      query.orderType = orderType;
    }
    
    // Get charges with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const charges = await ServiceCharge.find(query)
      .populate('createdBy', 'name email')
      .sort({ orderType: 1, chargeType: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ServiceCharge.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: charges,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCharges: total,
        hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getServiceCharges:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get single service charge
// @route   GET /api/settings/service-charges/:id
// @access  Private (Admin/Manager/Staff only)
const getServiceCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access service charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const charge = await ServiceCharge.findOne({
      _id: req.params.id,
      branchId: req.user.branchId
    }).populate('createdBy', 'name email');
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Service charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: charge,
      branchId: req.user.branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getServiceCharge:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create new service charge
// @route   POST /api/settings/service-charges
// @access  Private (Admin/Manager/Staff only)
const createServiceCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create service charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    // Check if min and max spend are provided
    if (req.body.minSpend === undefined || req.body.maxSpend === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both minimum spend and maximum spend are required'
      });
    }

    const { minSpend, maxSpend, orderType } = req.body;
    const branchId = req.user.branchId;

    // Check for overlapping price ranges for the same branch and order type
    // If the new charge is for "All" order type, it conflicts with any existing charge
    // If the new charge is for a specific order type, it conflicts with "All" or the same specific order type
    let query = { branchId };
    
    if (orderType === 'All') {
      // "All" conflicts with any existing charge
      query = { branchId };
    } else {
      // Specific order type conflicts with "All" or the same specific order type
      query = { 
        branchId,
        $or: [
          { orderType: 'All' },
          { orderType: orderType }
        ]
      };
    }
    
    const overlappingCharges = await ServiceCharge.find({
      ...query,
      $or: [
        // New range completely contains an existing range
        { 
          minSpend: { $gte: minSpend }, 
          maxSpend: { $lte: maxSpend } 
        },
        // New range's min is within an existing range
        { 
          minSpend: { $lte: minSpend }, 
          maxSpend: { $gte: minSpend } 
        },
        // New range's max is within an existing range
        { 
          minSpend: { $lte: maxSpend }, 
          maxSpend: { $gte: maxSpend } 
        },
        // New range is completely within an existing range
        { 
          minSpend: { $lte: minSpend }, 
          maxSpend: { $gte: maxSpend } 
        }
      ]
    });

    if (overlappingCharges.length > 0) {
      const overlappingCharge = overlappingCharges[0];
      const existingRange = `£${overlappingCharge.minSpend} - £${overlappingCharge.maxSpend > 0 ? overlappingCharge.maxSpend : 'No limit'}`;
      const newRange = `£${minSpend} - £${maxSpend > 0 ? maxSpend : 'No limit'}`;
      
      let conflictMessage = '';
      if (overlappingCharge.orderType === 'All' && orderType !== 'All') {
        conflictMessage = `A service charge for "All Order Types" already exists for price range ${existingRange}. You cannot create a specific order type charge for the overlapping range ${newRange}.`;
      } else if (orderType === 'All' && overlappingCharge.orderType !== 'All') {
        conflictMessage = `A service charge for "${overlappingCharge.orderType}" already exists for price range ${existingRange}. You cannot create an "All Order Types" charge for the overlapping range ${newRange}.`;
      } else {
        conflictMessage = `Service charge already exists for price range ${existingRange} (${overlappingCharge.orderType}). Your new range ${newRange} (${orderType}) overlaps with the existing range.`;
      }
      
      return res.status(400).json({
        success: false,
        message: conflictMessage
      });
    }
    
    // Create charge
    const chargeData = {
      ...req.body,
      branchId: req.user.branchId,
      createdBy: req.user.id
    };
    
    const charge = await ServiceCharge.create(chargeData);
    await charge.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: charge,
      message: 'Service charge created successfully'
    });
    
  } catch (error) {
    console.error('Error in createServiceCharge:', error);
    
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

// @desc    Update service charge
// @route   PUT /api/settings/service-charges/:id
// @access  Private (Admin/Manager/Staff only)
const updateServiceCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update service charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const charge = await ServiceCharge.findOneAndUpdate(
      { _id: req.params.id, branchId: req.user.branchId },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Service charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: charge,
      message: 'Service charge updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updateServiceCharge:', error);
    
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

// @desc    Delete service charge
// @route   DELETE /api/settings/service-charges/:id
// @access  Private (Admin/Manager/Staff only)
const deleteServiceCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete service charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const charge = await ServiceCharge.findOneAndDelete({
      _id: req.params.id,
      branchId: req.user.branchId
    });
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Service charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Service charge deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in deleteServiceCharge:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Calculate service charges for an order
// @route   POST /api/settings/service-charges/calculate
// @access  Public (for order calculation)
const calculateServiceCharges = async (req, res) => {
  try {
    const { branchId, orderType, orderTotal, includeOptional = true } = req.body;
    
    if (!branchId || !orderType || orderTotal === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID, order type, and order total are required'
      });
    }
    
    const charges = await ServiceCharge.calculateTotalCharges(
      branchId, 
      orderType, 
      orderTotal, 
      includeOptional
    );
    
    res.status(200).json({
      success: true,
      data: charges
    });
    
  } catch (error) {
    console.error('Error in calculateServiceCharges:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get service charge statistics for a branch
// @route   GET /api/settings/service-charges/stats
// @access  Private (Admin/Manager/Staff only)
const getServiceChargeStats = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access service charge statistics'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    
    // Get service charge statistics
    const stats = await ServiceCharge.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
      {
        $group: {
          _id: null,
          totalCharges: { $sum: 1 },
          activeCharges: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          mandatoryCharges: {
            $sum: { $cond: [{ $eq: ['$optional', false] }, 1, 0] }
          },
          optionalCharges: {
            $sum: { $cond: [{ $eq: ['$optional', true] }, 1, 0] }
          },
          averageValue: { $avg: '$value' },
          totalFixedCharges: {
            $sum: { $cond: [{ $eq: ['$chargeType', 'Fixed'] }, 1, 0] }
          },
          totalPercentageCharges: {
            $sum: { $cond: [{ $eq: ['$chargeType', 'Percentage'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const chargeStats = stats.length > 0 ? stats[0] : {
      totalCharges: 0,
      activeCharges: 0,
      mandatoryCharges: 0,
      optionalCharges: 0,
      averageValue: 0,
      totalFixedCharges: 0,
      totalPercentageCharges: 0
    };
    
    // Get charges by order type
    const chargesByOrderType = await ServiceCharge.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId), isActive: true } },
      {
        $group: {
          _id: '$orderType',
          count: { $sum: 1 },
          averageValue: { $avg: '$value' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        ...chargeStats,
        chargesByOrderType
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getServiceChargeStats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get applicable service charges for order type
// @route   GET /api/settings/service-charges/applicable/:orderType
// @access  Public (for order calculation)
const getApplicableCharges = async (req, res) => {
  try {
    const { orderType } = req.params;
    const { branchId, orderTotal } = req.query;
    
    if (!branchId || !orderTotal) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and order total are required'
      });
    }
    
    const applicableCharges = await ServiceCharge.findApplicableCharges(
      branchId, 
      orderType, 
      parseFloat(orderTotal)
    );
    
    res.status(200).json({
      success: true,
      data: applicableCharges
    });
    
  } catch (error) {
    console.error('Error in getApplicableCharges:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

module.exports = {
  getServiceCharges,
  getServiceCharge,
  createServiceCharge,
  updateServiceCharge,
  deleteServiceCharge,
  calculateServiceCharges,
  getServiceChargeStats,
  getApplicableCharges
}; 
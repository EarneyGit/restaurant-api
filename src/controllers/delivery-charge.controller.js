const { DeliveryCharge, PriceOverride, PostcodeExclusion } = require('../models/delivery-charge.model');
const mongoose = require('mongoose');
const { MANAGEMENT_ROLES } = require('../constants/roles');

// @desc    Get all delivery charges for a branch
// @route   GET /api/settings/delivery-charges
// @access  Private (Admin/Manager/Staff only)
const getDeliveryCharges = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access delivery charges'
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
    
    // Get charges with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const charges = await DeliveryCharge.find(query)
      .populate('createdBy', 'name email')
      .sort({ maxDistance: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await DeliveryCharge.countDocuments(query);
    
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
    console.error('Error in getDeliveryCharges:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get single delivery charge
// @route   GET /api/settings/delivery-charges/:id
// @access  Private (Admin/Manager/Staff only)
const getDeliveryCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access delivery charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const charge = await DeliveryCharge.findOne({
      _id: req.params.id,
      branchId: req.user.branchId
    }).populate('createdBy', 'name email');
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Delivery charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: charge,
      branchId: req.user.branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getDeliveryCharge:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create new delivery charge
// @route   POST /api/settings/delivery-charges
// @access  Private (Admin/Manager/Staff only)
const createDeliveryCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create delivery charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Create charge
    const chargeData = {
      ...req.body,
      branchId: req.user.branchId,
      createdBy: req.user.id
    };
    
    const charge = await DeliveryCharge.create(chargeData);
    await charge.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: charge,
      message: 'Delivery charge created successfully'
    });
    
  } catch (error) {
    console.error('Error in createDeliveryCharge:', error);
    
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

// @desc    Update delivery charge
// @route   PUT /api/settings/delivery-charges/:id
// @access  Private (Admin/Manager/Staff only)
const updateDeliveryCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update delivery charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const charge = await DeliveryCharge.findOneAndUpdate(
      { _id: req.params.id, branchId: req.user.branchId },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Delivery charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: charge,
      message: 'Delivery charge updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updateDeliveryCharge:', error);
    
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

// @desc    Delete delivery charge
// @route   DELETE /api/settings/delivery-charges/:id
// @access  Private (Admin/Manager/Staff only)
const deleteDeliveryCharge = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete delivery charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const charge = await DeliveryCharge.findOneAndDelete({
      _id: req.params.id,
      branchId: req.user.branchId
    });
    
    if (!charge) {
      return res.status(404).json({
        success: false,
        message: 'Delivery charge not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Delivery charge deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in deleteDeliveryCharge:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create multiple delivery charges (bulk)
// @route   POST /api/settings/delivery-charges/bulk
// @access  Private (Admin/Manager/Staff only)
const createBulkDeliveryCharges = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create delivery charges'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const { charges } = req.body;
    
    if (!Array.isArray(charges) || charges.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Charges array is required and cannot be empty'
      });
    }
    
    // Add branch and user info to each charge
    const chargesData = charges.map(charge => ({
      ...charge,
      branchId: req.user.branchId,
      createdBy: req.user.id
    }));
    
    const createdCharges = await DeliveryCharge.insertMany(chargesData);
    
    res.status(201).json({
      success: true,
      data: createdCharges,
      message: `${createdCharges.length} delivery charges created successfully`
    });
    
  } catch (error) {
    console.error('Error in createBulkDeliveryCharges:', error);
    
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

// Price Override Controllers

// @desc    Get all price overrides for a branch
// @route   GET /api/settings/delivery-charges/price-overrides
// @access  Private (Admin/Manager/Staff only)
const getPriceOverrides = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access price overrides'
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
    
    // Get overrides with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const overrides = await PriceOverride.find(query)
      .populate('createdBy', 'name email')
      .sort({ prefix: 1, postfix: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PriceOverride.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: overrides,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalOverrides: total,
        hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getPriceOverrides:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create new price override
// @route   POST /api/settings/delivery-charges/price-overrides
// @access  Private (Admin/Manager/Staff only)
const createPriceOverride = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create price overrides'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Create override
    const overrideData = {
      ...req.body,
      branchId: req.user.branchId,
      createdBy: req.user.id
    };
    
    const override = await PriceOverride.create(overrideData);
    await override.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: override,
      message: 'Price override created successfully'
    });
    
  } catch (error) {
    console.error('Error in createPriceOverride:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Price override for this postcode already exists'
      });
    }
    
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

// @desc    Update price override
// @route   PUT /api/settings/delivery-charges/price-overrides/:id
// @access  Private (Admin/Manager/Staff only)
const updatePriceOverride = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update price overrides'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const override = await PriceOverride.findOneAndUpdate(
      { _id: req.params.id, branchId: req.user.branchId },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!override) {
      return res.status(404).json({
        success: false,
        message: 'Price override not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: override,
      message: 'Price override updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updatePriceOverride:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Price override for this postcode already exists'
      });
    }
    
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

// @desc    Delete price override
// @route   DELETE /api/settings/delivery-charges/price-overrides/:id
// @access  Private (Admin/Manager/Staff only)
const deletePriceOverride = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete price overrides'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const override = await PriceOverride.findOneAndDelete({
      _id: req.params.id,
      branchId: req.user.branchId
    });
    
    if (!override) {
      return res.status(404).json({
        success: false,
        message: 'Price override not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Price override deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in deletePriceOverride:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// Postcode Exclusion Controllers

// @desc    Get all postcode exclusions for a branch
// @route   GET /api/settings/delivery-charges/postcode-exclusions
// @access  Private (Admin/Manager/Staff only)
const getPostcodeExclusions = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access postcode exclusions'
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
    
    // Get exclusions with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const exclusions = await PostcodeExclusion.find(query)
      .populate('createdBy', 'name email')
      .sort({ prefix: 1, postfix: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PostcodeExclusion.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: exclusions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalExclusions: total,
        hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getPostcodeExclusions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create new postcode exclusion
// @route   POST /api/settings/delivery-charges/postcode-exclusions
// @access  Private (Admin/Manager/Staff only)
const createPostcodeExclusion = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create postcode exclusions'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Create exclusion
    const exclusionData = {
      ...req.body,
      branchId: req.user.branchId,
      createdBy: req.user.id
    };
    
    const exclusion = await PostcodeExclusion.create(exclusionData);
    await exclusion.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: exclusion,
      message: 'Postcode exclusion created successfully'
    });
    
  } catch (error) {
    console.error('Error in createPostcodeExclusion:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Postcode exclusion already exists'
      });
    }
    
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

// @desc    Update postcode exclusion
// @route   PUT /api/settings/delivery-charges/postcode-exclusions/:id
// @access  Private (Admin/Manager/Staff only)
const updatePostcodeExclusion = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update postcode exclusions'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const exclusion = await PostcodeExclusion.findOneAndUpdate(
      { _id: req.params.id, branchId: req.user.branchId },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!exclusion) {
      return res.status(404).json({
        success: false,
        message: 'Postcode exclusion not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: exclusion,
      message: 'Postcode exclusion updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updatePostcodeExclusion:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Postcode exclusion already exists'
      });
    }
    
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

// @desc    Delete postcode exclusion
// @route   DELETE /api/settings/delivery-charges/postcode-exclusions/:id
// @access  Private (Admin/Manager/Staff only)
const deletePostcodeExclusion = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete postcode exclusions'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const exclusion = await PostcodeExclusion.findOneAndDelete({
      _id: req.params.id,
      branchId: req.user.branchId
    });
    
    if (!exclusion) {
      return res.status(404).json({
        success: false,
        message: 'Postcode exclusion not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Postcode exclusion deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in deletePostcodeExclusion:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Calculate delivery charge for postcode and distance
// @route   POST /api/settings/delivery-charges/calculate
// @access  Public (for order calculation)
const calculateDeliveryCharge = async (req, res) => {
  try {
    const { branchId, postcode, distance, orderTotal } = req.body;
    
    if (!branchId || !postcode || distance === undefined || !orderTotal) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID, postcode, distance, and order total are required'
      });
    }
    
    // Check if postcode is excluded
    const isExcluded = await PostcodeExclusion.isPostcodeExcluded(branchId, postcode);
    if (isExcluded) {
      return res.status(400).json({
        success: false,
        message: 'Delivery not available to this postcode',
        deliverable: false
      });
    }
    
    // Check for postcode override first
    const override = await PriceOverride.findPostcodeOverride(branchId, postcode);
    if (override && orderTotal >= override.minSpend) {
      return res.status(200).json({
        success: true,
        data: {
          charge: override.charge,
          type: 'postcode_override',
          postcode: override.fullPostcode,
          minSpend: override.minSpend
        },
        deliverable: true
      });
    }
    
    // Find applicable distance-based charge
    const charge = await DeliveryCharge.findApplicableCharge(branchId, distance, orderTotal);
    if (!charge) {
      return res.status(400).json({
        success: false,
        message: 'No delivery charge found for this distance and order total',
        deliverable: false
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        charge: charge.charge,
        type: 'distance_based',
        maxDistance: charge.maxDistance,
        minSpend: charge.minSpend,
        maxSpend: charge.maxSpend
      },
      deliverable: true
    });
    
  } catch (error) {
    console.error('Error in calculateDeliveryCharge:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

module.exports = {
  // Delivery Charges
  getDeliveryCharges,
  getDeliveryCharge,
  createDeliveryCharge,
  updateDeliveryCharge,
  deleteDeliveryCharge,
  createBulkDeliveryCharges,
  
  // Price Overrides
  getPriceOverrides,
  createPriceOverride,
  updatePriceOverride,
  deletePriceOverride,
  
  // Postcode Exclusions
  getPostcodeExclusions,
  createPostcodeExclusion,
  updatePostcodeExclusion,
  deletePostcodeExclusion,
  
  // Public
  calculateDeliveryCharge
}; 
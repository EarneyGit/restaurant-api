const { DeliveryCharge, PriceOverride, PostcodeExclusion } = require('../models/delivery-charge.model');
const mongoose = require('mongoose');
const { MANAGEMENT_ROLES } = require('../constants/roles');
const DistanceCache = require('../models/distance-cache.model');

// @desc    Get branch location for delivery charges (coords)
// @route   GET /api/settings/delivery-charges/branch-location
// @access  Private (Admin/Manager/Staff only)
const getBranchLocationForCharges = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access branch location'
      });
    }

    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const Branch = mongoose.model('Branch');
    const branch = await Branch.findById(req.user.branchId).select('location address name');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    let latitude = null;
    let longitude = null;
    let formattedAddress = null;
    let postcode = null;

    if (branch.location && Array.isArray(branch.location.coordinates) && branch.location.coordinates.length === 2) {
      longitude = branch.location.coordinates[0];
      latitude = branch.location.coordinates[1];
      formattedAddress = branch.location.formattedAddress || null;
    }
    if (branch.address && branch.address.postalCode) {
      postcode = branch.address.postalCode;
      if (!formattedAddress) formattedAddress = branch.address.postalCode;
    }

    return res.status(200).json({
      success: true,
      data: {
        branchId: req.user.branchId.toString(),
        name: branch.name,
        latitude,
        longitude,
        formattedAddress,
        postcode
      }
    });
  } catch (error) {
    console.error('Error in getBranchLocationForCharges:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

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
    
    // Convert provided distance (miles from admin/UI) to meters for comparison
    const distanceInMetersFromMiles = Number(distance) * 1609.34;
    
    // Find applicable distance-based charge (expects meters)
    const charge = await DeliveryCharge.findApplicableCharge(branchId, distanceInMetersFromMiles, orderTotal);
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

// @desc    Calculate delivery charge by coordinates
// @route   POST /api/settings/delivery-charges/calculate-by-coordinates
// @access  Public (for order calculation)
const calculateDeliveryChargeByCoordinates = async (req, res) => {
  try {
    const { branchId, customerLat, customerLng, postcode, orderTotal } = req.body;
    
    if (!branchId || customerLat === undefined || customerLng === undefined || !orderTotal) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID, customer coordinates, and order total are required'
      });
    }
    
    // Get branch details with coordinates
    const Branch = mongoose.model('Branch');
    const branch = await Branch.findById(branchId);
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Check if branch has coordinates
    if (!branch.location || !branch.location.coordinates || branch.location.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Branch coordinates not configured. Please update branch location settings.',
        deliverable: false
      });
    }
    
    const branchLng = branch.location.coordinates[0];
    const branchLat = branch.location.coordinates[1];
    
    // Check if postcode is excluded (if postcode is provided)
    if (postcode) {
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
            minSpend: override.minSpend,
            distance: null // Distance not calculated for postcode overrides
          },
          deliverable: true
        });
      }
    }
    
    // Prefer cached distance first
    let distanceInMeters;
    const cached = await DistanceCache.findCachedDistance(branchLat, branchLng, customerLat, customerLng);
    if (cached) {
      distanceInMeters = cached.distanceMeters;
    } else {
      // Calculate distance using Google Maps API
      const googleMapsService = require('../utils/googleMaps');
      const distanceResult = await googleMapsService.calculateDistance(
        { lat: branchLat, lng: branchLng },
        { lat: customerLat, lng: customerLng },
        'imperial', // Use miles
        'driving'
      );
      
      if (!distanceResult.success) {
        return res.status(400).json({
          success: false,
          message: distanceResult.error || 'Failed to calculate distance',
          deliverable: false
        });
      }
      distanceInMeters = distanceResult.data.distance.value;
      // Upsert cache
      await DistanceCache.upsertDistance(branchLat, branchLng, customerLat, customerLng, distanceInMeters, 'google');
    }
    
    // Derive miles for display only
    const distanceInMiles = distanceInMeters / 1609.34;
    
    // Find applicable distance-based charge (expects meters)
    const charge = await DeliveryCharge.findApplicableCharge(branchId, distanceInMeters, orderTotal);
    if (!charge) {
      return res.status(400).json({
        success: false,
        message: 'No delivery charge found for this distance and order total. You may be outside our delivery area.',
        deliverable: false,
        distance: distanceInMiles.toFixed(2)
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        charge: charge.charge,
        type: 'distance_based',
        distance: distanceInMiles.toFixed(2),
        distanceText: `${distanceInMiles.toFixed(2)} mi`,
        duration: null,
        maxDistance: charge.maxDistance,
        minSpend: charge.minSpend,
        maxSpend: charge.maxSpend
      },
      deliverable: true
    });
    
  } catch (error) {
    console.error('Error in calculateDeliveryChargeByCoordinates:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Calculate delivery charge for checkout with user address validation
// @route   POST /api/settings/delivery-charges/calculate-checkout
// @access  Public (for checkout calculation)
// @desc    Validate delivery distance and provide meaningful error messages
// @route   POST /api/settings/delivery-charges/validate-delivery
// @access  Public
const validateDeliveryDistance = async (req, res) => {
  try {
    const { branchId, orderTotal, userAddress, searchedAddress } = req.body;
    
    if (!branchId || !orderTotal) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and order total are required'
      });
    }
    
    let customerAddress = null;
    let addressSource = 'none';
    
    // Priority 1: Use searched address if provided
    if (searchedAddress && searchedAddress.postcode) {
      customerAddress = searchedAddress;
      addressSource = 'searched';
    }
    // Priority 2: Use user saved address if provided
    else if (userAddress) {
      // Handle different user address formats
      if (typeof userAddress === 'string') {
        // Simple address string - try to extract postcode
        const postcodeMatch = userAddress.match(/([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
        if (postcodeMatch) {
          customerAddress = { postcode: postcodeMatch[1].toUpperCase() };
          addressSource = 'user_string';
        }
      } else if (userAddress.postcode || userAddress.postalCode) {
        // Structured address object
        customerAddress = {
          postcode: userAddress.postcode || userAddress.postalCode,
          street: userAddress.street || userAddress.addressLine1,
          city: userAddress.city,
          country: userAddress.country || 'GB'
        };
        addressSource = 'user_structured';
      }
    }
    
    if (!customerAddress || !customerAddress.postcode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid delivery address with postcode.',
        deliverable: false,
        addressSource
      });
    }
    
    // Check if postcode is excluded
    const isExcluded = await PostcodeExclusion.isPostcodeExcluded(branchId, customerAddress.postcode);
    if (isExcluded) {
      return res.status(400).json({
        success: false,
        message: 'We do not deliver to this postcode area. Please choose a different address or select pickup instead.',
        deliverable: false,
        addressSource
      });
    }
    
    // Check for postcode override first
    const override = await PriceOverride.findPostcodeOverride(branchId, customerAddress.postcode);
    if (override && orderTotal >= override.minSpend) {
      return res.status(200).json({
        success: true,
        data: {
          charge: override.charge,
          type: 'postcode_override',
          postcode: override.fullPostcode,
          minSpend: override.minSpend,
          distance: null,
          addressSource
        },
        deliverable: true
      });
    }
    
    // Get branch details with coordinates
    const Branch = mongoose.model('Branch');
    const branch = await Branch.findById(branchId);
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Check if branch has coordinates
    if (!branch.location || !branch.location.coordinates || branch.location.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Branch location not configured. Please contact support.',
        deliverable: false
      });
    }
    
    const branchLng = branch.location.coordinates[0];
    const branchLat = branch.location.coordinates[1];
    
    // Get customer coordinates from postcode if not already provided
    let customerLat, customerLng;
    
    if (searchedAddress && searchedAddress.latitude && searchedAddress.longitude) {
      customerLat = searchedAddress.latitude;
      customerLng = searchedAddress.longitude;
    } else {
      // Get coordinates from Google Maps
      const googleMapsService = require('../utils/googleMaps');
      const addressResult = await googleMapsService.postcodeToAddress(customerAddress.postcode);
      if (!addressResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Unable to verify this address. Please check your postcode and try again.',
          deliverable: false,
          addressSource
        });
      }
      customerLat = addressResult.data.latitude;
      customerLng = addressResult.data.longitude;
    }
    
    // Prefer cached distance first
    let distanceInMeters;
    const cached = await DistanceCache.findCachedDistance(branchLat, branchLng, customerLat, customerLng);
    if (cached) {
      distanceInMeters = cached.distanceMeters;
    } else {
      const googleMapsService = require('../utils/googleMaps');
      const distanceResult = await googleMapsService.calculateDistance(
        { lat: branchLat, lng: branchLng },
        { lat: customerLat, lng: customerLng },
        'imperial',
        'driving'
      );
      
      if (!distanceResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Unable to calculate delivery distance. Please try again.',
          deliverable: false,
          addressSource
        });
      }
      distanceInMeters = distanceResult.data.distance.value;
      // Upsert cache
      await DistanceCache.upsertDistance(branchLat, branchLng, customerLat, customerLng, distanceInMeters, 'google');
    }
    
    const distanceInMiles = distanceInMeters / 1609.34;
    
    // Get all active delivery charges for this branch to check max distance
    const allCharges = await DeliveryCharge.find({
      branchId: branchId,
      isActive: true
    }).sort({ maxDistance: 1 });
    
    if (allCharges.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No delivery charges configured for this branch. Please contact support.',
        deliverable: false,
        addressSource
      });
    }
    
    // Get the maximum delivery distance
    const maxDeliveryDistance = Math.max(...allCharges.map(charge => charge.maxDistance || 0));
    const maxDeliveryDistanceMeters = maxDeliveryDistance * 1609.34;
    
    if (distanceInMeters > maxDeliveryDistanceMeters) {
      return res.status(400).json({
        success: false,
        message: `We do not deliver to this location. Your address is ${distanceInMiles.toFixed(1)} miles away, but we only deliver within ${maxDeliveryDistance} miles. Please choose a closer address or select pickup instead.`,
        deliverable: false,
        distance: distanceInMiles.toFixed(2),
        maxDistance: maxDeliveryDistance,
        addressSource
      });
    }
    
    // Find applicable distance-based charge (expects meters)
    const charge = await DeliveryCharge.findApplicableCharge(branchId, distanceInMeters, orderTotal);
    if (!charge) {
      // Check if it's a minimum spend issue
      const minSpendRequired = Math.min(...allCharges.map(charge => charge.minSpend || 0));
      if (orderTotal < minSpendRequired) {
        return res.status(400).json({
          success: false,
          message: `Minimum order value for delivery is £${minSpendRequired.toFixed(2)}. Please add more items to your order or choose pickup instead.`,
          deliverable: false,
          distance: distanceInMiles.toFixed(2),
          minSpendRequired: minSpendRequired,
          addressSource
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Unable to calculate delivery charge for this location. Please contact support.',
        deliverable: false,
        distance: distanceInMiles.toFixed(2),
        addressSource
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        charge: charge.charge,
        type: 'distance_based',
        distance: distanceInMiles.toFixed(2),
        distanceText: `${distanceInMiles.toFixed(2)} mi`,
        duration: null,
        maxDistance: charge.maxDistance,
        minSpend: charge.minSpend,
        maxSpend: charge.maxSpend,
        postcode: customerAddress.postcode,
        addressSource
      },
      deliverable: true
    });
    
  } catch (error) {
    console.error('Error in validateDeliveryDistance:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to validate delivery. Please try again.',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

const calculateDeliveryChargeForCheckout = async (req, res) => {
  try {
    const { branchId, orderTotal, userAddress, searchedAddress } = req.body;
    
    if (!branchId || !orderTotal) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID and order total are required'
      });
    }
    
    let customerAddress = null;
    let addressSource = 'none';
    
    // Priority 1: Use searched address if provided
    if (searchedAddress && searchedAddress.postcode) {
      customerAddress = searchedAddress;
      addressSource = 'searched';
    }
    // Priority 2: Use user saved address if provided
    else if (userAddress) {
      // Handle different user address formats
      if (typeof userAddress === 'string') {
        // Simple address string - try to extract postcode
        const postcodeMatch = userAddress.match(/([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})/i);
        if (postcodeMatch) {
          customerAddress = { postcode: postcodeMatch[1].toUpperCase() };
          addressSource = 'user_string';
        }
      } else if (userAddress.postcode || userAddress.postalCode) {
        // Structured address object
        customerAddress = {
          postcode: userAddress.postcode || userAddress.postalCode,
          street: userAddress.street || userAddress.addressLine1,
          city: userAddress.city,
          country: userAddress.country || 'GB'
        };
        addressSource = 'user_structured';
      }
    }
    
    if (!customerAddress || !customerAddress.postcode) {
      return res.status(400).json({
        success: false,
        message: 'No valid address provided. Please provide a delivery address with postcode.',
        deliverable: false,
        addressSource
      });
    }
    
    // Check if postcode is excluded
    const isExcluded = await PostcodeExclusion.isPostcodeExcluded(branchId, customerAddress.postcode);
    if (isExcluded) {
      return res.status(400).json({
        success: false,
        message: 'Delivery not available to this postcode',
        deliverable: false,
        addressSource
      });
    }
    
    // Check for postcode override first
    const override = await PriceOverride.findPostcodeOverride(branchId, customerAddress.postcode);
    if (override && orderTotal >= override.minSpend) {
      return res.status(200).json({
        success: true,
        data: {
          charge: override.charge,
          type: 'postcode_override',
          postcode: override.fullPostcode,
          minSpend: override.minSpend,
          distance: null,
          addressSource
        },
        deliverable: true
      });
    }
    
    // Get branch details with coordinates
    const Branch = mongoose.model('Branch');
    const branch = await Branch.findById(branchId);
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Check if branch has coordinates
    if (!branch.location || !branch.location.coordinates || branch.location.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Branch coordinates not configured. Please update branch location settings.',
        deliverable: false
      });
    }
    
    const branchLng = branch.location.coordinates[0];
    const branchLat = branch.location.coordinates[1];
    
    // Get customer coordinates from postcode if not already provided
    let customerLat, customerLng;
    
    if (searchedAddress && searchedAddress.latitude && searchedAddress.longitude) {
      customerLat = searchedAddress.latitude;
      customerLng = searchedAddress.longitude;
    } else {
      // Get coordinates from Google Maps
      const googleMapsService = require('../utils/googleMaps');
      const addressResult = await googleMapsService.postcodeToAddress(customerAddress.postcode);
      if (!addressResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to get coordinates for the provided postcode',
          deliverable: false,
          addressSource
        });
      }
      customerLat = addressResult.data.latitude;
      customerLng = addressResult.data.longitude;
    }
    
    // Calculate distance using Google Maps API
    const googleMapsService = require('../utils/googleMaps');
    const distanceResult = await googleMapsService.calculateDistance(
      { lat: branchLat, lng: branchLng },
      { lat: customerLat, lng: customerLng },
      'imperial', // Use miles
      'driving'
    );
    
    if (!distanceResult.success) {
      return res.status(400).json({
        success: false,
        message: distanceResult.error || 'Failed to calculate distance',
        deliverable: false,
        addressSource
      });
    }
    
    // Extract distance in meters (from Google) and derive miles for display only
    const distanceInMeters = distanceResult.data.distance.value;
    const distanceInMiles = distanceInMeters / 1609.34;
    
    // Find applicable distance-based charge (expects meters)
    const charge = await DeliveryCharge.findApplicableCharge(branchId, distanceInMeters, orderTotal);
    if (!charge) {
      return res.status(400).json({
        success: false,
        message: 'No delivery charge found for this distance and order total. You may be outside our delivery area or order total may not meet minimum spend requirements.',
        deliverable: false,
        distance: distanceInMiles.toFixed(2),
        addressSource,
        debug: {
          distance: distanceInMiles,
          orderTotal,
          postcode: customerAddress.postcode
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        charge: charge.charge,
        type: 'distance_based',
        distance: distanceInMiles.toFixed(2),
        distanceText: distanceResult.data.distance.text,
        duration: distanceResult.data.duration.text,
        maxDistance: charge.maxDistance,
        minSpend: charge.minSpend,
        maxSpend: charge.maxSpend,
        postcode: customerAddress.postcode,
        addressSource
      },
      deliverable: true
    });
    
  } catch (error) {
    console.error('Error in calculateDeliveryChargeForCheckout:', error);
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
  calculateDeliveryCharge,
  calculateDeliveryChargeByCoordinates,
  calculateDeliveryChargeForCheckout,
  validateDeliveryDistance,
  
  // Branch location for delivery charges
  getBranchLocationForCharges
}; 
const Attribute = require('../models/attribute.model');
const Branch = require('../models/branch.model');

// @desc    Get all attributes
// @route   GET /api/attributes
// @access  Public (Branch-based)
exports.getAttributes = async (req, res, next) => {
  try {
    let query = { isActive: true };
    let targetBranchId = null;
    
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (isAdmin) {
      // Admin users: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      targetBranchId = req.user.branchId;
      query.branchId = targetBranchId;
    } else {
      // Regular users and guests: Use branch from query parameter
      if (!req.query.branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required. Please select a branch.'
        });
      }
      targetBranchId = req.query.branchId;
      query.branchId = targetBranchId;
    }

    // Search by name if specified
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }

    const attributes = await Attribute.find(query)
      .populate('branchId', 'name address')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: attributes.length,
      data: attributes,
      branchId: targetBranchId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single attribute
// @route   GET /api/attributes/:id
// @access  Public
exports.getAttribute = async (req, res, next) => {
  try {
    const attribute = await Attribute.findById(req.params.id)
      .populate('branchId', 'name address');

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: `Attribute not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: attribute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new attribute
// @route   POST /api/attributes
// @access  Private (Admin only)
exports.createAttribute = async (req, res, next) => {
  try {
    // Get branchId from authenticated admin user
    if (!req.user || !req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: 'Admin user must be associated with a branch'
      });
    }

    // Set branchId from authenticated user
    req.body.branchId = req.user.branchId;

    // Validate branch exists
    const branch = await Branch.findById(req.body.branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Set default availableDays if not provided
    if (!req.body.availableDays || req.body.availableDays.length === 0) {
      req.body.availableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    }

    const attribute = await Attribute.create(req.body);
    
    // Fetch the populated attribute to return
    const populatedAttribute = await Attribute.findById(attribute._id)
      .populate('branchId', 'name address');

    res.status(201).json({
      success: true,
      data: populatedAttribute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update attribute
// @route   PUT /api/attributes/:id
// @access  Private (Admin only)
exports.updateAttribute = async (req, res, next) => {
  try {
    let attribute = await Attribute.findById(req.params.id);

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: `Attribute not found with id of ${req.params.id}`
      });
    }

    // Ensure admin can only update attributes from their branch
    if (!req.user || !req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: 'Admin user must be associated with a branch'
      });
    }

    if (attribute.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update attributes from other branches'
      });
    }

    // Don't allow branchId to be changed in update
    if (req.body.branchId) {
      delete req.body.branchId;
    }

    attribute = await Attribute.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      data: attribute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete attribute
// @route   DELETE /api/attributes/:id
// @access  Private (Admin only)
exports.deleteAttribute = async (req, res, next) => {
  try {
    const attribute = await Attribute.findById(req.params.id);

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: `Attribute not found with id of ${req.params.id}`
      });
    }

    // Ensure admin can only delete attributes from their branch
    if (!req.user || !req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: 'Admin user must be associated with a branch'
      });
    }

    if (attribute.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete attributes from other branches'
      });
    }

    // Soft delete by setting isActive to false
    await Attribute.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      data: {},
      message: 'Attribute deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attributes by branch
// @route   GET /api/attributes/branch/:branchId
// @access  Public
exports.getAttributesByBranch = async (req, res, next) => {
  try {
    const attributes = await Attribute.find({ 
      branchId: req.params.branchId,
      isActive: true 
    })
      .populate('branchId', 'name address')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: attributes.length,
      data: attributes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder attributes
// @route   PUT /api/attributes/reorder
// @access  Private (Admin only)
exports.reorderAttributes = async (req, res, next) => {
  try {
    const { attributeOrders } = req.body;

    if (!attributeOrders || !Array.isArray(attributeOrders)) {
      return res.status(400).json({
        success: false,
        message: 'attributeOrders array is required'
      });
    }

    // Ensure admin can only reorder attributes from their branch
    if (!req.user || !req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: 'Admin user must be associated with a branch'
      });
    }

    // Verify all attributes belong to the admin's branch
    const attributeIds = attributeOrders.map(item => item.id);
    const attributes = await Attribute.find({ 
      _id: { $in: attributeIds },
      branchId: req.user.branchId 
    });

    if (attributes.length !== attributeIds.length) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reorder attributes from other branches'
      });
    }

    const updatePromises = attributeOrders.map(({ id, displayOrder }) => 
      Attribute.findByIdAndUpdate(id, { displayOrder }, { new: true })
    );

    await Promise.all(updatePromises);

    // Fetch updated attributes
    const updatedAttributes = await Attribute.find({ 
      branchId: req.user.branchId,
      isActive: true 
    })
      .populate('branchId', 'name address')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: updatedAttributes,
      message: 'Attributes reordered successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get offline attributes for admin's branch
// @route   GET /api/attributes/offline
// @access  Private (Admin/Manager/Staff)
exports.getOfflineAttributes = async (req, res, next) => {
  try {
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access offline attributes'
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    let query = { branchId: req.user.branchId };
    
    // Search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: 'i' };
    }

    const attributes = await Attribute.find(query)
      .populate('branchId', 'name address')
      .sort('name');

    // Transform attributes to match frontend structure
    const transformedAttributes = attributes.map(attribute => ({
      id: attribute._id,
      name: attribute.name,
      type: attribute.type,
      isRequired: attribute.isRequired,
      isActive: attribute.isActive,
      isOffline: !attribute.isActive // isActive represents online status
    }));

    res.status(200).json({
      success: true,
      count: transformedAttributes.length,
      data: transformedAttributes,
      branchId: req.user.branchId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle attribute offline status
// @route   PATCH /api/attributes/:id/toggle-offline
// @access  Private (Admin/Manager/Staff)
exports.toggleAttributeOffline = async (req, res, next) => {
  try {
    const { isOffline } = req.body;

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can toggle attribute offline status'
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    let attribute = await Attribute.findById(req.params.id);

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: `Attribute not found with id of ${req.params.id}`
      });
    }

    // Check if attribute belongs to admin's branch
    if (attribute.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update attributes from other branches'
      });
    }

    // Update isActive field (opposite of offline status)
    attribute = await Attribute.findByIdAndUpdate(
      req.params.id, 
      { isActive: !isOffline },
      { new: true, runValidators: true }
    ).populate('branchId', 'name address');

    // Transform attribute data to match frontend structure
    const transformedAttribute = {
      id: attribute._id,
      name: attribute.name,
      type: attribute.type,
      isRequired: attribute.isRequired,
      isActive: attribute.isActive,
      isOffline: !attribute.isActive
    };

    res.status(200).json({
      success: true,
      data: transformedAttribute,
      message: `Attribute ${isOffline ? 'taken offline' : 'brought online'} successfully`
    });
  } catch (error) {
    next(error);
  }
}; 
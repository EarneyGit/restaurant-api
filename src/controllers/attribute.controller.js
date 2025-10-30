const { MANAGEMENT_ROLES } = require("../constants/roles");
const Attribute = require("../models/attribute.model");
const Branch = require("../models/branch.model");

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
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    // Handle branch determination based on user type
    if (isAdmin) {
      // Admin users: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`,
        });
      }
      targetBranchId = req.user.branchId;
      query.branchId = targetBranchId;
    } else {
      // Regular users and guests: Use branch from query parameter
      if (!req.query.branchId) {
        return res.status(400).json({
          success: false,
          message: "Branch ID is required. Please select a branch.",
        });
      }
      targetBranchId = req.query.branchId;
      query.branchId = targetBranchId;
    }

    // Search by name if specified
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: "i" };
    }

    const attributes = await Attribute.find(query)
      .populate("branchId", "name address")
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: attributes.length,
      data: attributes,
      branchId: targetBranchId,
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
    const attribute = await Attribute.findById(req.params.id).populate(
      "branchId",
      "name address"
    );

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: `Attribute not found with id of ${req.params.id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: attribute,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new attribute
// @route   POST /api/attributes
// @access  Private (Staff and above)
exports.createAttribute = async (req, res, next) => {
  try {
    // Get branchId from authenticated user
    console.log("🔄 Request Headers:", req.headers);
    console.log("🔄 Request Body:", req.body);
    console.log("🔄 User:", req.user);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: "User must be associated with a branch",
      });
    }

    // Initialize request body if it doesn't exist
    const attributeData = {
      name: req.body?.name,
      type: req.body?.type || "single",
      requiresSelection:
        req.body?.requiresSelection === undefined
          ? true
          : req.body.requiresSelection,
      description: req.body?.description || "",
      displayOrder: req.body?.displayOrder || 0,
      minAttribute: req.body?.minAttribute || 0,
      maxAttribute: req.body?.maxAttribute || 0,
      branchId: req.user.branchId,
      isActive: true,
    };

    // Validate required fields
    if (!attributeData.name) {
      console.log("❌ Name validation failed:", attributeData);
      return res.status(400).json({
        success: false,
        message: "Name is required for the attribute",
      });
    }

    // Validate branch exists
    const branch = await Branch.findById(attributeData.branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    console.log("✅ Creating attribute with data:", attributeData);
    const attribute = await Attribute.create(attributeData);

    // Fetch the populated attribute to return
    const populatedAttribute = await Attribute.findById(attribute._id).populate(
      "branchId",
      "name address"
    );

    console.log("✅ Created attribute:", populatedAttribute);
    res.status(201).json({
      success: true,
      data: populatedAttribute,
    });
  } catch (error) {
    console.error("❌ Error in createAttribute:", error);
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
        message: `Attribute not found with id of ${req.params.id}`,
      });
    }

    // Ensure admin can only update attributes from their branch
    if (!req.user || !req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: "Admin user must be associated with a branch",
      });
    }

    if (attribute.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update attributes from other branches",
      });
    }

    // Don't allow branchId to be changed in update
    if (req.body.branchId) {
      delete req.body.branchId;
    }

    attribute = await Attribute.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("branchId", "name address");

    res.status(200).json({
      success: true,
      data: attribute,
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
        message: `Attribute not found with id of ${req.params.id}`,
      });
    }

    // Ensure admin can only delete attributes from their branch
    if (!req.user || !req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: "Admin user must be associated with a branch",
      });
    }

    if (attribute.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete attributes from other branches",
      });
    }

    // Soft delete by setting isActive to false
    await Attribute.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      data: {},
      message: "Attribute deleted successfully",
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
      isActive: true,
    })
      .populate("branchId", "name address")
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: attributes.length,
      data: attributes,
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
        message: "attributeOrders array is required",
      });
    }

    // Ensure admin can only reorder attributes from their branch
    if (!req.user || !req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: "Admin user must be associated with a branch",
      });
    }

    // Verify all attributes belong to the admin's branch
    const attributeIds = attributeOrders.map((item) => item.id);
    const attributes = await Attribute.find({
      _id: { $in: attributeIds },
      branchId: req.user.branchId,
    });

    if (attributes.length !== attributeIds.length) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reorder attributes from other branches",
      });
    }

    const updatePromises = attributeOrders.map(({ id, displayOrder }) =>
      Attribute.findByIdAndUpdate(id, { displayOrder }, { new: true })
    );

    await Promise.all(updatePromises);

    // Fetch updated attributes
    const updatedAttributes = await Attribute.find({
      branchId: req.user.branchId,
      isActive: true,
    })
      .populate("branchId", "name address")
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: updatedAttributes,
      message: "Attributes reordered successfully",
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
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access offline attributes",
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    let query = { branchId: req.user.branchId };

    // Search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: "i" };
    }

    const attributes = await Attribute.find(query)
      .populate("branchId", "name address")
      .sort("name");

    // Transform attributes to match frontend structure
    const transformedAttributes = attributes.map((attribute) => ({
      id: attribute._id,
      name: attribute.name,
      type: attribute.type,
      isRequired: attribute.isRequired,
      isActive: attribute.isActive,
      isOffline: !attribute.isActive, // isActive represents online status
    }));

    res.status(200).json({
      success: true,
      count: transformedAttributes.length,
      data: transformedAttributes,
      branchId: req.user.branchId,
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
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can toggle attribute offline status",
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    let attribute = await Attribute.findById(req.params.id);

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: `Attribute not found with id of ${req.params.id}`,
      });
    }

    // Check if attribute belongs to admin's branch
    if (attribute.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update attributes from other branches",
      });
    }

    // Update isActive field (opposite of offline status)
    attribute = await Attribute.findByIdAndUpdate(
      req.params.id,
      { isActive: !isOffline },
      { new: true, runValidators: true }
    ).populate("branchId", "name address");

    // Transform attribute data to match frontend structure
    const transformedAttribute = {
      id: attribute._id,
      name: attribute.name,
      type: attribute.type,
      isRequired: attribute.isRequired,
      isActive: attribute.isActive,
      isOffline: !attribute.isActive,
    };

    res.status(200).json({
      success: true,
      data: transformedAttribute,
      message: `Attribute ${
        isOffline ? "taken offline" : "brought online"
      } successfully`,
    });
  } catch (error) {
    next(error);
  }
};

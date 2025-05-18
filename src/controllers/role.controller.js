const Role = require('../models/role.model');

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (admin only)
exports.getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ displayOrder: 1 });

    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single role
// @route   GET /api/roles/:id
// @access  Private (admin only)
exports.getRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: `Role not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new role
// @route   POST /api/roles
// @access  Private (admin only)
exports.createRole = async (req, res, next) => {
  try {
    // Extract role data from request body
    const { name, description, isActive, displayOrder } = req.body;

    // Create role
    const role = await Role.create({
      name,
      description,
      isActive,
      displayOrder,
      isSystemRole: false // Only system can create system roles
    });

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private (admin only)
exports.updateRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: `Role not found with id of ${req.params.id}`
      });
    }

    // Prevent modification of system roles except for description and active status
    if (role.isSystemRole) {
      const allowedUpdates = ['description', 'isActive'];
      
      // Filter out disallowed fields for system roles
      Object.keys(req.body).forEach(key => {
        if (!allowedUpdates.includes(key)) {
          delete req.body[key];
        }
      });
    }

    // Update role
    const updatedRole = await Role.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: updatedRole
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Private (admin only)
exports.deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: `Role not found with id of ${req.params.id}`
      });
    }

    // Prevent deletion of system roles
    if (role.isSystemRole) {
      return res.status(400).json({
        success: false,
        message: 'System roles cannot be deleted'
      });
    }

    // Check if role is in use
    const User = require('../models/user.model');
    const usersWithRole = await User.countDocuments({ roleId: role._id });

    if (usersWithRole > 0) {
      return res.status(400).json({
        success: false,
        message: `This role is assigned to ${usersWithRole} user(s) and cannot be deleted`
      });
    }

    await role.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}; 
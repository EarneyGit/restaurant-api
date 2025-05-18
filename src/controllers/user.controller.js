const User = require('../models/user.model');
const Branch = require('../models/branch.model');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    let query = {};
    
    // Get user role from roleId
    const userRole = req.user.roleId ? req.user.roleId.slug : null;
    
    // Allow filtering by role
    if (req.query.role) {
      query.role = req.query.role;
    }
    
    // Allow filtering by branch for admin
    if (userRole === 'admin' && req.query.branch) {
      query.branchId = req.query.branch;
    }
    
    // Restrict managers to only see staff from their branch
    if (userRole === 'manager') {
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: 'Manager must be assigned to a branch'
        });
      }
      query.branchId = req.user.branchId;
      
      // Managers can only see staff and regular users
      query.role = { $in: ['staff', 'user'] };
    }
    
    // Regular staff can't access user list
    if (userRole === 'staff' || userRole === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access user list'
      });
    }

    const users = await User.find(query).populate('branchId', 'name address').populate('roleId', 'name slug');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('branchId', 'name address')
      .populate('roleId', 'name slug');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user.roleId ? req.user.roleId.slug : null;
    const targetUserRole = user.roleId ? user.roleId.slug : null;
    
    // Managers can only view staff from their branch or regular users
    if (userRole === 'manager') {
      if (targetUserRole === 'admin' || (targetUserRole === 'manager' && user._id.toString() !== req.user._id.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this user'
        });
      }
      
      if (targetUserRole === 'staff' && (!user.branchId || user.branchId.toString() !== req.user.branchId.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view staff from other branches'
        });
      }
    }
    
    // Regular staff and users can only view their own profile
    if (['staff', 'user'].includes(userRole) && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view other user profiles'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address, branchId } = req.body;
    
    // Validate branch assignment for staff and manager roles
    if (['staff', 'manager'].includes(role)) {
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: `Branch ID is required for ${role} role`
        });
      }
      
      // Verify branch exists
      const branch = await Branch.findById(branchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }
      
      if (!branch.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign user to inactive branch'
        });
      }
      
      // If creating a manager, check if branch already has a manager
      if (role === 'manager') {
        const existingManager = await User.findOne({
          role: 'manager',
          branchId,
          isActive: true
        });
        
        if (existingManager) {
          return res.status(400).json({
            success: false,
            message: 'Branch already has an active manager'
          });
        }
      }
    }
    
    // Check if requesting user is admin by looking at the roleId
    const isAdmin = req.user && req.user.roleId && req.user.roleId.slug === 'admin';
    
    // Only admins can create other admins or managers
    if (!isAdmin && (role === 'admin' || role === 'manager')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create admin or manager users'
      });
    }
    
    // If manager is creating staff, make sure they're assigned to their branch
    if (req.user.roleId && req.user.roleId.slug === 'manager' && role === 'staff') {
      if (branchId.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only create staff for your own branch'
        });
      }
    }
    
    // Create user
    const userData = {
      name,
      email,
      password,
      phone: phone || '',
      address: address || ''
    };
    
    // Find the role by slug and set the roleId
    const Role = require('../models/role.model');
    if (role) {
      const roleDoc = await Role.findOne({ slug: role.toLowerCase() });
      if (roleDoc) {
        userData.roleId = roleDoc._id;
      } else {
        return res.status(400).json({
          success: false,
          message: `Role '${role}' not found`
        });
      }
    }
    
    // Only add branchId for staff and manager roles
    if (['staff', 'manager'].includes(role)) {
      userData.branchId = branchId;
    }
    
    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Create user error:', error);
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('roleId', 'name slug')
      .populate('branchId', 'name address');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id of ${req.params.id}`
      });
    }
    
    // Get user roles from roleId
    const userRole = req.user.roleId ? req.user.roleId.slug : null;
    const targetUserRole = user.roleId ? user.roleId.slug : null;
    
    // Check authorization
    if (userRole !== 'admin') {
      // Managers can only update staff from their branch
      if (userRole === 'manager') {
        if (targetUserRole === 'admin' || (targetUserRole === 'manager' && user._id.toString() !== req.user._id.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to update admin or other manager accounts'
          });
        }
        
        if (targetUserRole === 'staff' && (!user.branchId || user.branchId.toString() !== req.user.branchId.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to update staff from other branches'
          });
        }
        
        // Prevent managers from changing user roles to admin or manager
        if (req.body.role === 'admin' || req.body.role === 'manager') {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to change user role to admin or manager'
          });
        }
        
        // Prevent managers from changing staff branch
        if (req.body.branchId && req.body.branchId.toString() !== req.user.branchId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Cannot assign staff to a different branch'
          });
        }
      } else {
        // Regular users and staff can only update their own profiles
        if (user._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to update other user profiles'
          });
        }
        
        // Prevent role changes
        if (req.body.role && req.body.role !== targetUserRole) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to change user role'
          });
        }
        
        // Prevent branch changes
        if (req.body.branchId) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to change branch assignment'
          });
        }
      }
    }

    // Don't update password through this route
    if (req.body.password) {
      delete req.body.password;
    }
    
    // Parse role to roleId if provided
    if (req.body.role) {
      const Role = require('../models/role.model');
      const roleDoc = await Role.findOne({ slug: req.body.role.toLowerCase() });
      if (roleDoc) {
        req.body.roleId = roleDoc._id;
        delete req.body.role; // Remove role as we're using roleId
      } else {
        return res.status(400).json({
          success: false,
          message: `Role '${req.body.role}' not found`
        });
      }
    }
    
    // Validate branch assignment for staff and manager roles
    if (req.body.roleId) {
      const Role = require('../models/role.model');
      const newRole = await Role.findById(req.body.roleId);
      if (newRole && ['staff', 'manager'].includes(newRole.slug) && !user.branchId && !req.body.branchId) {
        return res.status(400).json({
          success: false,
          message: `Branch ID is required for ${newRole.name} role`
        });
      }
    } else if (req.body.role && ['staff', 'manager'].includes(req.body.role) && !user.branchId && !req.body.branchId) {
      return res.status(400).json({
        success: false,
        message: `Branch ID is required for ${req.body.role} role`
      });
    }
    
    // If changing to a manager role, check if branch already has a manager
    const newRoleSlug = req.body.role || (req.body.roleId ? await getRoleSlug(req.body.roleId) : null);
    if (newRoleSlug === 'manager' && targetUserRole !== 'manager') {
      const branchToCheck = req.body.branchId || user.branchId;
      
      if (branchToCheck) {
        const existingManager = await User.findOne({
          _id: { $ne: user._id },
          role: 'manager',
          branchId: branchToCheck,
          isActive: true
        });
        
        if (existingManager) {
          return res.status(400).json({
            success: false,
            message: 'Branch already has an active manager'
          });
        }
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('roleId', 'name slug').populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    next(error);
  }
};

// Helper to get role slug
async function getRoleSlug(roleId) {
  try {
    const Role = require('../models/role.model');
    const role = await Role.findById(roleId);
    return role ? role.slug : null;
  } catch (err) {
    console.error('Error getting role slug:', err);
    return null;
  }
}

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id of ${req.params.id}`
      });
    }
    
    // Only admin can delete users
    const userRole = req.user.roleId ? req.user.roleId.slug : null;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete users'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Delete user error:', error);
    next(error);
  }
}; 
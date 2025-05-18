const Category = require('../models/category.model');
const Branch = require('../models/branch.model');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public (with role-based filtering)
exports.getCategories = async (req, res, next) => {
  try {
    let query = { isActive: true };
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Filter by branch if specified
    if (req.query.branch) {
      query.branchId = req.query.branch;
    }
    
    // For manager/staff, only show categories from their branch
    if (userRole === 'manager' || userRole === 'staff') {
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      query.branchId = req.user.branchId;
    }
    
    // For admin, show all categories unless filtered
    // For public users, show all active categories

    const categories = await Category.find(query)
      .populate('branchId', 'name address')
      .populate('parentCategory', 'name slug');

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public (with role-based access control)
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('branchId', 'name address')
      .populate('parentCategory', 'name slug');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, check if category belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        category.branchId && 
        req.user.branchId && 
        category.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this category'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private/Admin/Manager/Staff
exports.createCategory = async (req, res, next) => {
  try {
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Default to user's branch if not specified
    if (!req.body.branchId && (userRole === 'manager' || userRole === 'staff')) {
      req.body.branchId = req.user.branchId;
    }
    
    // Validate branch assignment
    if (!req.body.branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }
    
    // Verify branch exists
    const branch = await Branch.findById(req.body.branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // For manager/staff, ensure they're creating for their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.body.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create categories for other branches'
      });
    }
    
    // If parentCategory is provided, ensure it exists and belongs to same branch
    if (req.body.parentCategory) {
      const parentCategory = await Category.findById(req.body.parentCategory);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      
      if (parentCategory.branchId.toString() !== req.body.branchId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Parent category must belong to the same branch'
        });
      }
    }

    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin/Manager/Staff
exports.updateCategory = async (req, res, next) => {
  try {
    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, check if category belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        category.branchId && 
        req.user.branchId && 
        category.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this category'
      });
    }
    
    // Prevent changing branchId for manager/staff
    if (req.body.branchId && 
        (userRole === 'manager' || userRole === 'staff') && 
        req.body.branchId.toString() !== category.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to change branch assignment'
      });
    }
    
    // If parentCategory is provided, ensure it exists and belongs to same branch
    if (req.body.parentCategory) {
      const parentCategory = await Category.findById(req.body.parentCategory);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      
      const branchToCheck = req.body.branchId || category.branchId;
      if (parentCategory.branchId.toString() !== branchToCheck.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Parent category must belong to the same branch'
        });
      }
    }

    category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin/Manager
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot delete categories
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to delete categories'
      });
    }
    
    // For manager, check if category belongs to their branch
    if (userRole === 'manager' && 
        category.branchId && 
        req.user.branchId && 
        category.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this category'
      });
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get category with products
// @route   GET /api/categories/:id/products
// @access  Public
exports.getCategoryProducts = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found with id of ${req.params.id}`
      });
    }

    const products = await category.populate('products');

    res.status(200).json({
      success: true,
      count: products.products.length,
      data: {
        category,
        products: products.products
      }
    });
  } catch (error) {
    next(error);
  }
}; 
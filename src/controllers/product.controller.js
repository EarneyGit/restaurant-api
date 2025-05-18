const Product = require('../models/product.model');
const Category = require('../models/category.model');
const Branch = require('../models/branch.model');

// @desc    Get all products
// @route   GET /api/products
// @access  Public (with role-based filtering)
exports.getProducts = async (req, res, next) => {
  try {
    let query = { isAvailable: true };
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Apply filters if provided
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (req.query.branch) {
      query.branchId = req.query.branch;
    }

    // For manager/staff, only show products from their branch
    if (userRole === 'manager' || userRole === 'staff') {
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      query.branchId = req.user.branchId;
    }
    
    // For admin, show all products unless filtered
    // For public users, show all available products

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public (with role-based access control)
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('branchId', 'name address');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, check if product belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        product.branchId && 
        req.user.branchId && 
        product.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this product'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin/Manager/Staff
exports.createProduct = async (req, res, next) => {
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
        message: 'Not authorized to create products for other branches'
      });
    }
    
    // Validate category exists and belongs to the same branch
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      if (category.branchId.toString() !== req.body.branchId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Category must belong to the same branch as the product'
        });
      }
    }

    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin/Manager/Staff
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, check if product belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        product.branchId && 
        req.user.branchId && 
        product.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }
    
    // Prevent changing branchId for manager/staff
    if (req.body.branchId && 
        (userRole === 'manager' || userRole === 'staff') && 
        req.body.branchId.toString() !== product.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to change branch assignment'
      });
    }
    
    // If category is being changed, validate it belongs to the same branch
    if (req.body.category && req.body.category !== product.category.toString()) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      const branchToCheck = req.body.branchId || product.branchId;
      if (category.branchId.toString() !== branchToCheck.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Category must belong to the same branch as the product'
        });
      }
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('category', 'name slug').populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin/Manager
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot delete products
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to delete products'
      });
    }
    
    // For manager, check if product belongs to their branch
    if (userRole === 'manager' && 
        product.branchId && 
        req.user.branchId && 
        product.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get popular products
// @route   GET /api/products/popular
// @access  Public
exports.getPopularProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isPopular: true })
      .populate('category', 'name')
      .limit(8);

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recommended products
// @route   GET /api/products/recommended
// @access  Public
exports.getRecommendedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isRecommended: true })
      .populate('category', 'name')
      .limit(8);

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
}; 
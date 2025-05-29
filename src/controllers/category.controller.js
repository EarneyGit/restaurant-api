const Category = require('../models/category.model');
const Branch = require('../models/branch.model');
const Product = require('../models/product.model');
const { saveSingleFile } = require('../utils/fileUpload');
const mongoose = require('mongoose');
const { MANAGEMENT_ROLES } = require('../constants/roles');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public (Branch-based)
exports.getCategories = async (req, res, next) => {
  try {
    let query = {};
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

    // Search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: 'i' };
    }

    // Get categories without products
    const categories = await Category.find(query)
      .populate({
        path: 'branchId',
        select: 'name address'
      })
      .sort('displayOrder')
      .lean();

    // Transform categories to match frontend structure
    const transformedCategories = categories.map(category => ({
      id: category._id,
      name: category.name,
      displayOrder: category.displayOrder,
      hidden: category.hidden,
      includeAttributes: category.includeAttributes || false,
      includeDiscounts: category.includeDiscounts || false,
      imageUrl: category.imageUrl || '',
      availability: category.availability,
      printers: category.printers || [],
      branch: category.branchId
    }));

    res.status(200).json({
      success: true,
      count: transformedCategories.length,
      data: transformedCategories,
      branchId: targetBranchId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public (Branch-based)
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate({
        path: 'branchId',
        select: 'name address'
      })
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found with id of ${req.params.id}`
      });
    }

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    // Handle branch verification based on user type
    if (isAdmin) {
      // Admin users: Check if category belongs to their branch
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      
      if (category.branchId._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Category not found in your branch'
        });
      }
    } else {
      // Regular users and guests: Check branch from query parameter
      const requestedBranchId = req.query.branchId;
      
      if (!requestedBranchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required. Please select a branch.'
        });
      }
      
      // Check if category belongs to the requested branch
      if (category.branchId._id.toString() !== requestedBranchId) {
        return res.status(403).json({
          success: false,
          message: 'Category not found in the selected branch'
        });
      }
    }

    // Transform data to match frontend structure
    const transformedCategory = {
      id: category._id,
      name: category.name,
      displayOrder: category.displayOrder,
      hidden: category.hidden,
      includeAttributes: category.includeAttributes || false,
      includeDiscounts: category.includeDiscounts || false,
      imageUrl: category.imageUrl || '',
      availability: category.availability,
      printers: category.printers || [],
      branch: category.branchId
    };

    res.status(200).json({
      success: true,
      data: transformedCategory
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
    const categoryData = req.body;

    // Handle file upload if present
    if (req.file) {
      const imagePath = await saveSingleFile(req.file, 'categories');
      categoryData.imageUrl = imagePath;
    }

    // Parse availability data if it's a string
    if (typeof categoryData.availability === 'string') {
      try {
        categoryData.availability = JSON.parse(categoryData.availability);
      } catch (e) {
        console.error('Error parsing availability:', e);
      }
    }

    // Process availability data to ensure proper structure
    if (categoryData.availability) {
      const processedAvailability = {};
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      daysOfWeek.forEach(day => {
        if (categoryData.availability[day]) {
          // If it's a string (old format), convert to new format
          if (typeof categoryData.availability[day] === 'string') {
            processedAvailability[day] = {
              type: categoryData.availability[day],
              startTime: null,
              endTime: null
            };
          } else {
            // New format with type, startTime, endTime
            processedAvailability[day] = {
              type: categoryData.availability[day].type || 'All Day',
              startTime: categoryData.availability[day].startTime || null,
              endTime: categoryData.availability[day].endTime || null
            };
          }
        } else {
          processedAvailability[day] = {
            type: 'All Day',
            startTime: null,
            endTime: null
          };
        }
      });
      
      categoryData.availability = processedAvailability;
    }

    // Get user role from roleId
    const userRole = req.user ? req.user.role : null;
    
    // Default to user's branch if not specified
    if (!categoryData.branchId && (userRole === 'admin' || userRole === 'manager' || userRole === 'staff')) {
      categoryData.branchId = req.user.branchId;
    }
    
    // Validate branch assignment
    if (!categoryData.branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }
    
    // Verify branch exists
    const branch = await Branch.findById(categoryData.branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // For admin/manager/staff, ensure they're creating for their branch
    if ((userRole === 'admin' || userRole === 'manager' || userRole === 'staff') && 
        categoryData.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create categories for other branches'
      });
    }

    const category = await Category.create(categoryData);

    // Transform response to match frontend structure
    const transformedCategory = {
      id: category._id,
      name: category.name,
      displayOrder: category.displayOrder,
      hidden: category.hidden,
      includeAttributes: category.includeAttributes || false,
      includeDiscounts: category.includeDiscounts || false,
      imageUrl: category.imageUrl || '',
      availability: category.availability,
      printers: category.printers || [],
      items: []
    };

    res.status(201).json({
      success: true,
      data: transformedCategory
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
    const updateData = req.body;

    // Handle file upload if present
    if (req.file) {
      const imagePath = await saveSingleFile(req.file, 'categories');
      updateData.imageUrl = imagePath;
    }

    // Parse availability data if it's a string
    if (typeof updateData.availability === 'string') {
      try {
        updateData.availability = JSON.parse(updateData.availability);
      } catch (e) {
        console.error('Error parsing availability:', e);
      }
    }

    // Process availability data to ensure proper structure
    if (updateData.availability) {
      const processedAvailability = {};
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      daysOfWeek.forEach(day => {
        if (updateData.availability[day]) {
          // If it's a string (old format), convert to new format
          if (typeof updateData.availability[day] === 'string') {
            processedAvailability[day] = {
              type: updateData.availability[day],
              startTime: null,
              endTime: null
            };
          } else {
            // New format with type, startTime, endTime
            processedAvailability[day] = {
              type: updateData.availability[day].type || 'All Day',
              startTime: updateData.availability[day].startTime || null,
              endTime: updateData.availability[day].endTime || null
            };
          }
        } else {
          processedAvailability[day] = {
            type: 'All Day',
            startTime: null,
            endTime: null
          };
        }
      });
      
      updateData.availability = processedAvailability;
    }

    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user ? req.user.role : null;
    
    // For manager/staff/admin, check if category belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff' || userRole === 'admin') && 
        category.branchId && 
        req.user.branchId && 
        category.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this category'
      });
    }
    
    // Prevent changing branchId for manager/staff/admin
    if (req.body.branchId && 
        (userRole === 'manager' || userRole === 'staff' || userRole === 'admin') && 
        req.body.branchId.toString() !== category.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to change branch assignment'
      });
    }

    category = await Category.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    })
    .populate({
      path: 'items',
      select: 'name price hideItem delivery collection dineIn description weight calorificValue calorieDetails'
    })
    .populate('branchId', 'name address');

    // Transform response to match frontend structure
    const transformedCategory = {
      id: category._id,
      name: category.name,
      displayOrder: category.displayOrder,
      hidden: category.hidden,
      includeAttributes: category.includeAttributes || false,
      includeDiscounts: category.includeDiscounts || false,
      imageUrl: category.imageUrl || '',
      availability: category.availability,
      printers: category.printers || [],
      items: category.items.map(item => ({
        id: item._id,
        name: item.name,
        price: item.price,
        hideItem: item.hideItem || false,
        delivery: item.delivery || true,
        collection: item.collection || true,
        dineIn: item.dineIn || true,
        description: item.description,
        weight: item.weight,
        calorificValue: item.calorificValue,
        calorieDetails: item.calorieDetails
      }))
    };

    res.status(200).json({
      success: true,
      data: transformedCategory
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
    const userRole = req.user ? req.user.role : null;
    
    // Staff cannot delete categories
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to delete categories'
      });
    }
    
    // For manager/admin, check if category belongs to their branch
    if ((userRole === 'manager' || userRole === 'admin') && 
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

// @desc    Get all categories with product counts
// @route   GET /api/categories/counts
// @access  Public
exports.getCategoryProductCounts = async (req, res, next) => {
  try {
    let query = {};
    
    // Filter by branch if specified
    if (req.query.branch) {
      query.branchId = req.query.branch;
    }
    
    // Get all categories with product counts and product details
    const categoriesWithCounts = await Category.aggregate([
      {
        $match: query
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products"
        }
      },
      {
        $project: {
          id: "$_id",
          name: 1,
          productCount: { $size: "$products" },
          products: {
            $map: {
              input: "$products",
              as: "product",
              in: {
                name: "$$product.name",
                price: "$$product.price"
              }
            }
          },
          _id: 0
        }
      },
      {
        $sort: { name: 1 }
      }
    ]);
    
    res.status(200).json({
      success: true,
      count: categoriesWithCounts.length,
      data: categoriesWithCounts
    });
  } catch (error) {
    next(error);
  }
}; 

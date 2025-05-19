const Category = require('../models/category.model');
const Branch = require('../models/branch.model');
const Product = require('../models/product.model');
const { saveSingleFile } = require('../utils/fileUpload');
const mongoose = require('mongoose');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    let query = {};
    
    // Filter by branch if specified
    if (req.query.branch) {
      query.branchId = req.query.branch;
    }

    // Search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: 'i' };
    }

    // Get categories with their items
    const categories = await Category.find(query)
      .populate({
        path: 'branchId',
        select: 'name address'
      })
      .sort('displayOrder')
      .lean();

    // Get products for each category
    const categoriesWithProducts = await Promise.all(categories.map(async (category) => {
      const products = await Product.find({
        category: category._id,
        branchId: category.branchId._id
      }).select('name price hideItem delivery collection dineIn description weight calorificValue calorieDetails images availability allergens priceChanges').lean();

      return {
        id: category._id,
        name: category.name,
        displayOrder: category.displayOrder,
        hidden: category.hidden,
        imageUrl: category.imageUrl || '',
        availability: category.availability,
        printers: category.printers || [],
        items: products.map(item => ({
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
          calorieDetails: item.calorieDetails,
          images: item.images || [],
          availability: item.availability || {},
          allergens: item.allergens || { contains: [], mayContain: [] },
          priceChanges: item.priceChanges || []
        }))
      };
    }));

    res.status(200).json({
      success: true,
      count: categoriesWithProducts.length,
      data: categoriesWithProducts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
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

    // Get products for this category
    const products = await Product.find({
      category: category._id,
      branchId: category.branchId._id
    }).select('name price hideItem delivery collection dineIn description weight calorificValue calorieDetails images availability allergens priceChanges').lean();

    // Transform data to match frontend structure
    const transformedCategory = {
      id: category._id,
      name: category.name,
      displayOrder: category.displayOrder,
      hidden: category.hidden,
      imageUrl: category.imageUrl || '',
      availability: category.availability,
      printers: category.printers || [],
      items: products.map(item => ({
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
        calorieDetails: item.calorieDetails,
        images: item.images || [],
        availability: item.availability || {},
        allergens: item.allergens || { contains: [], mayContain: [] },
        priceChanges: item.priceChanges || []
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

    const category = await Category.create(categoryData);

    // Transform response to match frontend structure
    const transformedCategory = {
      id: category._id,
      name: category.name,
      displayOrder: category.displayOrder,
      hidden: category.hidden,
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
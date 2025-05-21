const Product = require('../models/product.model');
const Category = require('../models/category.model');
const Branch = require('../models/branch.model');
const { saveSingleFile, saveMultipleFiles, deleteFile } = require('../utils/fileUpload');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    let query = {};
    
    // Apply filters if provided
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (req.query.branch) {
      query.branchId = req.query.branch;
    }

    // Add search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: 'i' };
    }

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate('branchId', 'name address')
      .sort('name');

    // Transform products to match frontend structure
    const transformedProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      hideItem: product.hideItem ?? false,
      delivery: product.delivery !== undefined ? product.delivery : true,
      collection: product.collection !== undefined ? product.collection : true,
      dineIn: product.dineIn !== undefined ? product.dineIn : true,
      description: product.description,
      weight: product.weight,
      calorificValue: product.calorificValue,
      calorieDetails: product.calorieDetails,
      images: product.images || [],
      availability: product.availability || {},
      allergens: product.allergens || { contains: [], mayContain: [] },
      priceChanges: product.priceChanges || [],
      category: product.category,
      branch: product.branchId
    }));

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      data: transformedProducts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
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
// @access  Public
exports.createProduct = async (req, res, next) => {
  try {
    // Verify branch exists
    if (req.body.branchId) {
      const branch = await Branch.findById(req.body.branchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }
    }
    
    // Validate category exists
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
    }

    // Handle image uploads if present
    if (req.files && req.files.length > 0) {
      const imagePaths = await saveMultipleFiles(req.files, 'products');
      // Store only the relative paths without BACKEND_URL
      req.body.images = imagePaths;
    }

    // Parse JSON strings if they exist
    if (typeof req.body.availability === 'string') {
      req.body.availability = JSON.parse(req.body.availability);
    }
    if (typeof req.body.allergens === 'string') {
      req.body.allergens = JSON.parse(req.body.allergens);
    }
    if (typeof req.body.priceChanges === 'string') {
      req.body.priceChanges = JSON.parse(req.body.priceChanges);
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
// @access  Public
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`
      });
    }
    
    // Validate branch exists
    if (req.body.branchId) {
      const branch = await Branch.findById(req.body.branchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }
    }
    
    // Validate category exists
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
    }

    // Handle image uploads if present
    if (req.files && req.files.length > 0) {
      // Delete old images
      if (product.images && product.images.length > 0) {
        for (const imagePath of product.images) {
          await deleteFile(imagePath);
        }
      }

      // Save new images
      const imagePaths = await saveMultipleFiles(req.files, 'products');
      // Store only the relative paths without BACKEND_URL
      req.body.images = imagePaths;
    }

    // Parse JSON strings if they exist
    if (typeof req.body.availability === 'string') {
      req.body.availability = JSON.parse(req.body.availability);
    }
    if (typeof req.body.allergens === 'string') {
      req.body.allergens = JSON.parse(req.body.allergens);
    }
    if (typeof req.body.priceChanges === 'string') {
      req.body.priceChanges = JSON.parse(req.body.priceChanges);
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

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
// @access  Public
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`
      });
    }

    // Delete associated images
    if (product.images && product.images.length > 0) {
      for (const imagePath of product.images) {
        await deleteFile(imagePath);
      }
    }

    await Product.deleteOne({ _id: req.params.id });

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
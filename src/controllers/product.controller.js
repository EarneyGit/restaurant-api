const Product = require('../models/product.model');
const Category = require('../models/category.model');
const Branch = require('../models/branch.model');
const { saveSingleFile, saveMultipleFiles, deleteFile } = require('../utils/fileUpload');

// @desc    Get all products
// @route   GET /api/products
// @access  Public (Branch-based)
exports.getProducts = async (req, res, next) => {
  try {
    let query = {};
    let targetBranchId = null;
    
    // Determine user role and authentication status
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
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
    
    // Apply additional filters if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Add search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: 'i' };
    }

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate('branchId', 'name address')
      .populate('selectedItems', 'name price category')
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
      selectedItems: product.selectedItems?.map(item => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || '',
      cssClass: product.cssClass || '',
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date()
      }
    }));

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      data: transformedProducts,
      branchId: targetBranchId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public (Branch-based)
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('branchId', 'name address')
      .populate('selectedItems', 'name price category');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`
      });
    }

    // Determine user role and authentication status
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch verification based on user type
    if (isAdmin) {
      // Admin users: Check if product belongs to their branch
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      
      if (product.branchId._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Product not found in your branch'
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
      
      // Check if product belongs to the requested branch
      if (product.branchId._id.toString() !== requestedBranchId) {
        return res.status(403).json({
          success: false,
          message: 'Product not found in the selected branch'
        });
      }
    }

    // Transform product data to match frontend structure
    const transformedProduct = {
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
      selectedItems: product.selectedItems?.map(item => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || '',
      cssClass: product.cssClass || '',
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date()
      }
    };

    res.status(200).json({
      success: true,
      data: transformedProduct
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin/Manager/Staff)
exports.createProduct = async (req, res, next) => {
  try {
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Set branchId from authenticated user if not provided
    if (!req.body.branchId && (userRole === 'manager' || userRole === 'staff' || userRole === 'admin')) {
      req.body.branchId = req.user.branchId;
    }
    
    // Verify branch exists
    if (req.body.branchId) {
      const branch = await Branch.findById(req.body.branchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }
      
      // For manager/staff/admin, ensure they're creating for their branch
      if ((userRole === 'manager' || userRole === 'staff' || userRole === 'admin') && 
          req.body.branchId.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create products for other branches'
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
    if (typeof req.body.selectedItems === 'string') {
      req.body.selectedItems = JSON.parse(req.body.selectedItems);
    }
    if (typeof req.body.itemSettings === 'string') {
      req.body.itemSettings = JSON.parse(req.body.itemSettings);
    }

    // Convert string boolean values to actual booleans
    const booleanFields = ['hideItem', 'delivery', 'collection', 'dineIn', 'freeDelivery', 'collectionOnly', 'deleted', 'hidePrice'];
    booleanFields.forEach(field => {
      if (req.body[field] !== undefined) {
        req.body[field] = req.body[field] === 'true' || req.body[field] === true;
      }
    });

    const product = await Product.create(req.body);
    
    // Fetch the populated product to return
    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('branchId', 'name address')
      .populate('selectedItems', 'name price category');
      
    // Transform product data to match frontend structure
    const transformedProduct = {
      id: populatedProduct._id,
      name: populatedProduct.name,
      price: populatedProduct.price,
      hideItem: populatedProduct.hideItem ?? false,
      delivery: populatedProduct.delivery !== undefined ? populatedProduct.delivery : true,
      collection: populatedProduct.collection !== undefined ? populatedProduct.collection : true,
      dineIn: populatedProduct.dineIn !== undefined ? populatedProduct.dineIn : true,
      description: populatedProduct.description,
      weight: populatedProduct.weight,
      calorificValue: populatedProduct.calorificValue,
      calorieDetails: populatedProduct.calorieDetails,
      images: populatedProduct.images || [],
      availability: populatedProduct.availability || {},
      allergens: populatedProduct.allergens || { contains: [], mayContain: [] },
      priceChanges: populatedProduct.priceChanges || [],
      selectedItems: populatedProduct.selectedItems?.map(item => item._id) || [],
      itemSettings: populatedProduct.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false
      },
      category: populatedProduct.category,
      branch: populatedProduct.branchId,
      tillProviderProductId: populatedProduct.tillProviderProductId || '',
      cssClass: populatedProduct.cssClass || '',
      freeDelivery: populatedProduct.freeDelivery || false,
      collectionOnly: populatedProduct.collectionOnly || false,
      deleted: populatedProduct.deleted || false,
      hidePrice: populatedProduct.hidePrice || false,
      stockManagement: populatedProduct.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date()
      }
    };

    res.status(201).json({
      success: true,
      data: transformedProduct
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin/Manager/Staff)
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
    
    // For manager/staff/admin, check if product belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff' || userRole === 'admin') && 
        product.branchId && 
        req.user.branchId && 
        product.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update products from other branches'
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
      
      // For manager/staff/admin, ensure they're not changing to other branch
      if ((userRole === 'manager' || userRole === 'staff' || userRole === 'admin') && 
          req.body.branchId.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to move products to other branches'
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
    if (typeof req.body.selectedItems === 'string') {
      req.body.selectedItems = JSON.parse(req.body.selectedItems);
    }
    if (typeof req.body.itemSettings === 'string') {
      req.body.itemSettings = JSON.parse(req.body.itemSettings);
    }

    // Convert string boolean values to actual booleans
    const booleanFields = ['hideItem', 'delivery', 'collection', 'dineIn', 'freeDelivery', 'collectionOnly', 'deleted', 'hidePrice'];
    booleanFields.forEach(field => {
      if (req.body[field] !== undefined) {
        req.body[field] = req.body[field] === 'true' || req.body[field] === true;
      }
    });

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('category', 'name slug')
      .populate('branchId', 'name address')
      .populate('selectedItems', 'name price category');

    // Transform product data to match frontend structure
    const transformedProduct = {
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
      selectedItems: product.selectedItems?.map(item => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || '',
      cssClass: product.cssClass || '',
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date()
      }
    };

    res.status(200).json({
      success: true,
      data: transformedProduct
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
      .populate('branchId', 'name address')
      .populate('selectedItems', 'name price category')
      .limit(8);

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
      selectedItems: product.selectedItems?.map(item => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || '',
      cssClass: product.cssClass || '',
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date()
      }
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

// @desc    Get recommended products
// @route   GET /api/products/recommended
// @access  Public
exports.getRecommendedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isRecommended: true })
      .populate('category', 'name')
      .populate('branchId', 'name address')
      .populate('selectedItems', 'name price category')
      .limit(8);

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
      selectedItems: product.selectedItems?.map(item => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || '',
      cssClass: product.cssClass || '',
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date()
      }
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

// @desc    Bulk update stock for multiple products
// @route   PUT /api/products/stock/bulk-update
// @access  Public
exports.bulkUpdateStock = async (req, res, next) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products array is required'
      });
    }

    const updateResults = [];
    const errors = [];

    // Process each product update
    for (const productUpdate of products) {
      try {
        const { id, isManaged, quantity } = productUpdate;

        if (!id) {
          errors.push({ productId: null, error: 'Product ID is required' });
          continue;
        }

        // Validate quantity if provided
        if (quantity !== undefined && (quantity < 0 || !Number.isInteger(quantity))) {
          errors.push({ productId: id, error: 'Quantity must be a non-negative integer' });
          continue;
        }

        // Find and update the product
        const product = await Product.findById(id);
        if (!product) {
          errors.push({ productId: id, error: 'Product not found' });
          continue;
        }

        // Prepare stock management update
        const stockUpdate = {
          'stockManagement.lastUpdated': new Date()
        };

        if (isManaged !== undefined) {
          stockUpdate['stockManagement.isManaged'] = isManaged;
        }

        if (quantity !== undefined) {
          stockUpdate['stockManagement.quantity'] = quantity;
        }

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
          id, 
          stockUpdate, 
          { new: true, runValidators: true }
        );

        updateResults.push({
          productId: id,
          name: updatedProduct.name,
          stockManagement: updatedProduct.stockManagement,
          success: true
        });

      } catch (error) {
        errors.push({ 
          productId: productUpdate.id || 'unknown', 
          error: error.message 
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Stock updated successfully`,
      data: {
        updated: updateResults,
        errors: errors,
        totalProcessed: products.length,
        successCount: updateResults.length,
        errorCount: errors.length
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get stock status for all managed products
// @route   GET /api/products/stock/status
// @access  Public
exports.getStockStatus = async (req, res, next) => {
  try {
    let query = { 'stockManagement.isManaged': true };
    
    // Filter by branch if provided
    if (req.query.branchId) {
      query.branchId = req.query.branchId;
    }

    // Filter by category if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by low stock if requested
    if (req.query.lowStock === 'true') {
      query.$expr = {
        $lte: ['$stockManagement.quantity', '$stockManagement.lowStockThreshold']
      };
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('branchId', 'name')
      .select('name stockManagement category branchId')
      .sort('name');

    // Transform data for response
    const stockStatus = products.map(product => ({
      id: product._id,
      name: product.name,
      category: product.category,
      branch: product.branchId,
      stockManagement: product.stockManagement,
      isLowStock: product.stockManagement.quantity <= product.stockManagement.lowStockThreshold
    }));

    res.status(200).json({
      success: true,
      count: stockStatus.length,
      data: stockStatus
    });

  } catch (error) {
    next(error);
  }
}; 
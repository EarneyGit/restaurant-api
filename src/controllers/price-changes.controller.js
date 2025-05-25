const Product = require('../models/product.model');
const Category = require('../models/category.model');
const Branch = require('../models/branch.model');
const { v4: uuidv4 } = require('uuid');

// @desc    Get categories with products for price changes
// @route   GET /api/price-changes
// @access  Private (Admin/Manager/Staff)
exports.getPriceChangesData = async (req, res, next) => {
  try {
    // Get user role and ensure they're authenticated
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const branchId = req.user.branchId;
    
    // Build query based on showHidden flags
    let categoryQuery = { branchId };
    let productQuery = { branchId };
    
    if (req.query.showHiddenCategories !== 'true') {
      categoryQuery.hidden = { $ne: true };
    }
    
    if (req.query.showHiddenItems !== 'true') {
      productQuery.hideItem = { $ne: true };
    }

    // Get categories with their products
    const categories = await Category.find(categoryQuery)
      .sort('displayOrder')
      .lean();

    // Get all products for this branch
    const products = await Product.find(productQuery)
      .populate('category', 'name')
      .sort('name')
      .lean();

    // Group products by category
    const categoriesWithProducts = categories.map(category => {
      const categoryProducts = products.filter(product => 
        product.category && product.category._id.toString() === category._id.toString()
      );

      return {
        id: category._id,
        name: category.name,
        isExpanded: false,
        items: categoryProducts.map(product => ({
          id: product._id,
          name: product.name,
          currentPrice: product.price,
          newPrice: product.price
        }))
      };
    });

    res.status(200).json({
      success: true,
      data: categoriesWithProducts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Apply price changes to products
// @route   POST /api/price-changes
// @access  Private (Admin/Manager/Staff)
exports.applyPriceChanges = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const { startDate, endDate, categories } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Categories data is required'
      });
    }

    const branchId = req.user.branchId;
    const priceChangeId = uuidv4();
    const priceChangeName = `Price Change ${new Date().toLocaleDateString()}`;

    // Collect all product updates
    const productUpdates = [];

    for (const category of categories) {
      if (category.items && Array.isArray(category.items)) {
        for (const item of category.items) {
          if (item.newPrice !== item.currentPrice) {
            // Verify product belongs to admin's branch
            const product = await Product.findOne({ 
              _id: item.id, 
              branchId: branchId 
            });

            if (!product) {
              return res.status(403).json({
                success: false,
                message: `Product ${item.name} not found in your branch`
              });
            }

            // Create price change object
            const priceChange = {
              id: priceChangeId,
              name: priceChangeName,
              type: 'fixed',
              value: item.newPrice,
              startDate: startDate,
              endDate: endDate,
              daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
              active: true
            };

            productUpdates.push({
              productId: item.id,
              priceChange: priceChange
            });
          }
        }
      }
    }

    if (productUpdates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No price changes detected'
      });
    }

    // Apply price changes to products
    const updatePromises = productUpdates.map(update => 
      Product.findByIdAndUpdate(
        update.productId,
        { $push: { priceChanges: update.priceChange } },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: `Price changes applied to ${productUpdates.length} products`,
      data: {
        priceChangeId: priceChangeId,
        affectedProducts: productUpdates.length,
        startDate: startDate,
        endDate: endDate
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all price changes for admin's branch
// @route   GET /api/price-changes/list
// @access  Private (Admin/Manager/Staff)
exports.getPriceChangesList = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const branchId = req.user.branchId;

    // Get all products with price changes for this branch
    const products = await Product.find({ 
      branchId: branchId,
      'priceChanges.0': { $exists: true }
    })
    .populate('category', 'name')
    .select('name price priceChanges category')
    .lean();

    // Extract unique price changes
    const priceChangesMap = new Map();

    products.forEach(product => {
      product.priceChanges.forEach(priceChange => {
        if (!priceChangesMap.has(priceChange.id)) {
          priceChangesMap.set(priceChange.id, {
            id: priceChange.id,
            name: priceChange.name,
            startDate: priceChange.startDate,
            endDate: priceChange.endDate,
            active: priceChange.active,
            affectedProducts: []
          });
        }
        
        priceChangesMap.get(priceChange.id).affectedProducts.push({
          id: product._id,
          name: product.name,
          category: product.category?.name || 'Unknown',
          originalPrice: product.price,
          newPrice: priceChange.value
        });
      });
    });

    const priceChangesList = Array.from(priceChangesMap.values())
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    res.status(200).json({
      success: true,
      count: priceChangesList.length,
      data: priceChangesList
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update price change
// @route   PUT /api/price-changes/:id
// @access  Private (Admin/Manager/Staff)
exports.updatePriceChange = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const priceChangeId = req.params.id;
    const { name, startDate, endDate, active } = req.body;
    const branchId = req.user.branchId;

    // Find all products with this price change in admin's branch
    const products = await Product.find({ 
      branchId: branchId,
      'priceChanges.id': priceChangeId
    });

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Price change not found in your branch'
      });
    }

    // Update price change in all affected products
    const updatePromises = products.map(product => 
      Product.findOneAndUpdate(
        { 
          _id: product._id,
          'priceChanges.id': priceChangeId
        },
        {
          $set: {
            'priceChanges.$.name': name || product.priceChanges.find(pc => pc.id === priceChangeId).name,
            'priceChanges.$.startDate': startDate || product.priceChanges.find(pc => pc.id === priceChangeId).startDate,
            'priceChanges.$.endDate': endDate || product.priceChanges.find(pc => pc.id === priceChangeId).endDate,
            'priceChanges.$.active': active !== undefined ? active : product.priceChanges.find(pc => pc.id === priceChangeId).active
          }
        },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: `Price change updated for ${products.length} products`,
      data: {
        priceChangeId: priceChangeId,
        affectedProducts: products.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove price change
// @route   DELETE /api/price-changes/:id
// @access  Private (Admin/Manager/Staff)
exports.removePriceChange = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const priceChangeId = req.params.id;
    const branchId = req.user.branchId;

    // Find all products with this price change in admin's branch
    const products = await Product.find({ 
      branchId: branchId,
      'priceChanges.id': priceChangeId
    });

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Price change not found in your branch'
      });
    }

    // Remove price change from all affected products
    const updatePromises = products.map(product => 
      Product.findByIdAndUpdate(
        product._id,
        { $pull: { priceChanges: { id: priceChangeId } } },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: `Price change removed from ${products.length} products`,
      data: {
        priceChangeId: priceChangeId,
        affectedProducts: products.length
      }
    });
  } catch (error) {
    next(error);
  }
}; 
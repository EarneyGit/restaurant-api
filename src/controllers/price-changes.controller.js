const Product = require('../models/product.model');
const PriceChange = require('../models/price-change.model');
const Category = require('../models/category.model');
const { v4: uuidv4 } = require('uuid');

// Helper function to get current effective price for a product
const getCurrentEffectivePrice = async (productId) => {
  const now = new Date();
  const activePriceChange = await PriceChange.findOne({
    productId: productId,
    active: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ startDate: -1 });

  if (activePriceChange) {
    return {
      effectivePrice: activePriceChange.tempPrice || activePriceChange.value,
      hasActiveChange: true,
      activePriceChange: activePriceChange
    };
  }

  const product = await Product.findById(productId);
  return {
    effectivePrice: product?.price || 0,
    hasActiveChange: false,
    activePriceChange: null
  };
};

// Helper function to update product cache fields
const updateProductCache = async (productId) => {
  const priceInfo = await getCurrentEffectivePrice(productId);
  
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        currentEffectivePrice: priceInfo.effectivePrice,
        hasActivePriceChanges: priceInfo.hasActiveChange,
        activePriceChangeId: priceInfo.activePriceChange?.id || null
      }
    }
  );
};

// @desc    Get price changes data with current prices
// @route   GET /api/price-changes
// @access  Private (Admin/Manager/Staff)
exports.getPriceChangesData = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const branchId = req.user.branchId;
    const showHiddenCategories = req.query.showHiddenCategories === 'true';
    const showHiddenItems = req.query.showHiddenItems === 'true';

    // Build category filter
    const categoryFilter = { branchId: branchId };
    if (!showHiddenCategories) {
      categoryFilter.hideCategory = { $ne: true };
    }

    // Get categories
    const categories = await Category.find(categoryFilter)
      .select('name hideCategory')
      .lean();

    // Build product filter
    const productFilter = { branchId: branchId };
    if (!showHiddenItems) {
      productFilter.hideItem = { $ne: true };
    }

    // Get all products for this branch
    const products = await Product.find(productFilter)
      .populate('category', 'name')
      .select('name price currentEffectivePrice hasActivePriceChanges activePriceChangeId category')
      .lean();

    // Get active price changes for this branch
    const now = new Date();
    const activePriceChanges = await PriceChange.find({
      branchId: branchId,
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).lean();

    // Create a map for quick lookup
    const priceChangeMap = new Map();
    activePriceChanges.forEach(pc => {
      priceChangeMap.set(pc.productId.toString(), pc);
    });

    // Process categories and group products
    const processedCategories = categories.map(category => {
      // Filter products for this category
      const categoryProducts = products.filter(product => 
        product.category && product.category._id.toString() === category._id.toString()
      );

      return {
        id: category._id,
        name: category.name,
        isExpanded: false,
        items: categoryProducts.map(product => {
          const activePriceChange = priceChangeMap.get(product._id.toString());
          
          return {
            id: product._id,
            name: product.name,
            currentPrice: product.price,
            effectivePrice: product.currentEffectivePrice || product.price,
            tempPrice: product.currentEffectivePrice || product.price,
            revertPrice: product.price,
            hasActiveChange: !!activePriceChange,
            activePriceChangeId: activePriceChange?.id,
            activePriceChange: activePriceChange ? {
              id: activePriceChange.id,
              name: activePriceChange.name,
              startDate: activePriceChange.startDate,
              endDate: activePriceChange.endDate,
              tempPrice: activePriceChange.tempPrice || activePriceChange.value
            } : null
          };
        })
      };
    });

    res.status(200).json({
      success: true,
      data: processedCategories
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
    const branchId = req.user.branchId;

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

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const batchId = uuidv4(); // For grouping related price changes
    const priceChangeName = `Price Change ${new Date().toLocaleDateString()}`;
    const results = [];
    const errors = [];

    console.log('Processing categories:', categories.length) // Debug log
    console.log('Categories data:', JSON.stringify(categories, null, 2)) // Debug log

    for (const category of categories) {
      console.log('Processing category:', category.name) // Debug log
      if (category.items && Array.isArray(category.items)) {
        console.log('Category items count:', category.items.length) // Debug log
        for (const item of category.items) {
          console.log('Processing item:', item.name, 'Current:', item.currentPrice, 'Temp:', item.tempPrice) // Debug log
          if (item.tempPrice && item.tempPrice !== item.currentPrice) {
            console.log('Item qualifies for price change:', item.name) // Debug log
            try {
              // Get product to validate and get current price
              const product = await Product.findOne({
                _id: item.id,
                branchId: branchId
              });

              if (!product) {
                errors.push({
                  productId: item.id,
                  error: 'Product not found in your branch'
                });
                continue;
              }

              // Check for conflicting active price changes
              const conflictingPriceChange = await PriceChange.findOne({
                productId: item.id,
                active: true,
                $or: [
                  {
                    startDate: { $lte: end },
                    endDate: { $gte: start }
                  }
                ]
              });

              if (conflictingPriceChange) {
                // Deactivate conflicting price change
                await PriceChange.updateOne(
                  { _id: conflictingPriceChange._id },
                  { $set: { active: false } }
                );
              }

              // Generate unique ID for each individual price change
              const uniquePriceChangeId = uuidv4();

              // Create new price change
              const priceChangeData = {
                id: uniquePriceChangeId,
                productId: product._id,
                branchId: branchId,
                name: priceChangeName,
                type: 'temporary',
                originalPrice: product.price,
                tempPrice: parseFloat(item.tempPrice),
                revertPrice: product.price,
                value: parseFloat(item.tempPrice),
                startDate: start,
                endDate: end,
                active: true,
                autoRevert: true
              };

              await PriceChange.create(priceChangeData);

              console.log('Successfully created price change:', {
                id: uniquePriceChangeId,
                productName: product.name,
                originalPrice: product.price,
                tempPrice: parseFloat(item.tempPrice)
              }) // Debug log

              // Update product cache
              // await updateProductCache(product._id);

              results.push({
                productId: product._id,
                productName: product.name,
                priceChangeId: uniquePriceChangeId,
                originalPrice: product.price,
                newPrice: parseFloat(item.tempPrice)
              });

            } catch (error) {
              errors.push({
                productId: item.id,
                error: error.message
              });
            }
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Applied ${results.length} price changes${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      data: {
        batchId: batchId,
        affectedProducts: results.length,
        startDate: startDate,
        endDate: endDate,
        autoRevert: true,
        applied: results,
        errors: errors
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create individual price change for a product
// @route   POST /api/price-changes/individual
// @access  Private (Admin/Manager/Staff)
exports.createIndividualPriceChange = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const { 
      productId, 
      name, 
      type, 
      value, 
      startDate, 
      endDate, 
      daysOfWeek = [], 
      timeStart, 
      timeEnd,
      active = true 
    } = req.body;
    const branchId = req.user.branchId;

    if (!productId || !name || !type || value === undefined || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, name, type, value, start date, and end date are required'
      });
    }

    // Validate product exists and belongs to branch
    const product = await Product.findOne({
      _id: productId,
      branchId: branchId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your branch'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check for conflicting active price changes
    const conflictingPriceChange = await PriceChange.findOne({
      productId: productId,
      active: true,
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (conflictingPriceChange) {
      // Deactivate conflicting price change
      await PriceChange.updateOne(
        { _id: conflictingPriceChange._id },
        { $set: { active: false } }
      );
    }

    // Generate unique ID for the price change
    const uniquePriceChangeId = uuidv4();

    // Calculate price based on type
    let tempPrice;
    switch (type) {
      case 'increase':
        tempPrice = product.price * (1 + value / 100);
        break;
      case 'decrease':
        tempPrice = product.price * (1 - value / 100);
        break;
      case 'fixed':
        tempPrice = value;
        break;
      default:
        tempPrice = value;
    }

    // Create new price change
    const priceChangeData = {
      id: uniquePriceChangeId,
      productId: product._id,
      branchId: branchId,
      name: name,
      type: type,
      originalPrice: product.price,
      tempPrice: tempPrice,
      revertPrice: product.price,
      value: value,
      startDate: start,
      endDate: end,
      daysOfWeek: daysOfWeek || [],
      timeStart: timeStart || null,
      timeEnd: timeEnd || null,
      active: active,
      autoRevert: true,
      createdBy: req.user.id
    };

    const newPriceChange = await PriceChange.create(priceChangeData);

    res.status(201).json({
      success: true,
      message: 'Price change created successfully',
      data: {
        id: newPriceChange.id,
        productId: product._id,
        productName: product.name,
        priceChangeId: uniquePriceChangeId,
        originalPrice: product.price,
        newPrice: tempPrice,
        name: name,
        type: type,
        startDate: startDate,
        endDate: endDate,
        daysOfWeek: daysOfWeek,
        timeStart: timeStart,
        timeEnd: timeEnd,
        active: active
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get price changes for a specific product
// @route   GET /api/price-changes/product/:productId
// @access  Private (Admin/Manager/Staff)
exports.getProductPriceChanges = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const { productId } = req.params;
    const branchId = req.user.branchId;

    // Validate product exists and belongs to branch
    const product = await Product.findOne({
      _id: productId,
      branchId: branchId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your branch'
      });
    }

    // Get all price changes for this product
    const priceChanges = await PriceChange.find({
      productId: productId,
      branchId: branchId,
      deleted: { $ne: true }
    })
    .sort({ startDate: -1 })
    .lean();

    const now = new Date();
    
    // Format price changes
    const formattedPriceChanges = priceChanges.map(pc => ({
      id: pc.id,
      name: pc.name,
      type: pc.type,
      value: pc.value,
      startDate: pc.startDate,
      endDate: pc.endDate,
      daysOfWeek: pc.daysOfWeek || [],
      timeStart: pc.timeStart,
      timeEnd: pc.timeEnd,
      active: pc.active,
      originalPrice: pc.originalPrice,
      tempPrice: pc.tempPrice,
      revertPrice: pc.revertPrice,
      status: pc.active ? 
        (new Date(pc.startDate) > now ? 'future' : 
         new Date(pc.endDate) >= now ? 'current' : 'historical') : 
        'historical'
    }));

    res.status(200).json({
      success: true,
      data: formattedPriceChanges
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get temporary price changes categorized by status
// @route   GET /api/price-changes/temporary
// @access  Private (Admin/Manager/Staff)
exports.getTemporaryPriceChanges = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const branchId = req.user.branchId;
    const now = new Date();

    // Get all price changes for this branch with product info (including deleted ones)
    const priceChanges = await PriceChange.find({ branchId })
      .populate('productId', 'name price')
      .populate({
        path: 'productId',
        populate: {
          path: 'category',
          select: 'name'
        }
      })
      .sort({ startDate: -1 })
      .lean();

    console.log('Raw price changes from DB:', priceChanges.length) // Debug log
    console.log('Price changes details:', priceChanges.map(pc => ({ 
      id: pc.id, 
      productName: pc.productId?.name, 
      startDate: pc.startDate, 
      endDate: pc.endDate,
      active: pc.active,
      deleted: pc.deleted 
    }))) // Debug log

    // Filter out price changes with null productId (product was deleted)
    const validPriceChanges = priceChanges.filter(pc => pc.productId);

    // Process and categorize price changes
    const allPriceChanges = validPriceChanges.map(pc => ({
      id: pc.id,
      productId: pc.productId._id,
      productName: pc.productId.name,
      category: pc.productId.category?.name || 'Unknown',
      startDate: pc.startDate,
      endDate: pc.endDate,
      startPrice: pc.originalPrice,
      endPrice: pc.tempPrice || pc.value,
      revertPrice: pc.revertPrice,
      active: pc.active,
      name: pc.name,
      type: pc.type,
      deleted: pc.deleted || false,
      deletedAt: pc.deletedAt,
      daysOfWeek: pc.daysOfWeek || [],
      timeStart: pc.timeStart,
      timeEnd: pc.timeEnd
    }));

    // Separate active and deleted price changes
    const activePriceChanges = allPriceChanges.filter(pc => !pc.deleted);
    const deletedPriceChanges = allPriceChanges.filter(pc => pc.deleted);

    // Categorize active price changes
    const currentPriceChanges = activePriceChanges.filter(pc => 
      pc.active && 
      new Date(pc.startDate) <= now && 
      new Date(pc.endDate) >= now
    );

    const futurePriceChanges = activePriceChanges.filter(pc => 
      pc.active && 
      new Date(pc.startDate) > now
    );

    const historicalPriceChanges = activePriceChanges.filter(pc => 
      !pc.active || 
      new Date(pc.endDate) < now
    );

    res.status(200).json({
      success: true,
      data: {
        current: currentPriceChanges,
        future: futurePriceChanges,
        historical: historicalPriceChanges,
        deleted: deletedPriceChanges, // Add deleted items as a separate category
        counts: {
          current: currentPriceChanges.length,
          future: futurePriceChanges.length,
          historical: historicalPriceChanges.length,
          deleted: deletedPriceChanges.length,
          total: allPriceChanges.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get price change details by ID
// @route   GET /api/price-changes/:id/details
// @access  Private (Admin/Manager/Staff)
exports.getPriceChangeDetails = async (req, res, next) => {
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

    const priceChange = await PriceChange.findOne({
      id: priceChangeId,
      branchId: branchId
    })
    .populate('productId', 'name price')
    .populate({
      path: 'productId',
      populate: {
        path: 'category',
        select: 'name'
      }
    })
    .lean();

    if (!priceChange) {
      return res.status(404).json({
        success: false,
        message: 'Price change not found in your branch'
      });
    }

    // Check if the product still exists
    if (!priceChange.productId) {
      return res.status(404).json({
        success: false,
        message: 'Product associated with this price change no longer exists'
      });
    }

    const now = new Date();
    let status = 'historical';
    
    if (priceChange.active) {
      if (new Date(priceChange.startDate) > now) {
        status = 'future';
      } else if (new Date(priceChange.endDate) >= now) {
        status = 'current';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        id: priceChange.id,
        name: priceChange.name,
        productId: priceChange.productId._id,
        productName: priceChange.productId.name,
        category: priceChange.productId.category?.name || 'Unknown',
        startDate: priceChange.startDate,
        endDate: priceChange.endDate,
        startPrice: priceChange.originalPrice,
        endPrice: priceChange.tempPrice || priceChange.value,
        revertPrice: priceChange.revertPrice,
        active: priceChange.active,
        status: status,
        type: priceChange.type,
        autoRevert: priceChange.autoRevert
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a price change
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
    const branchId = req.user.branchId;
    const { name, startDate, endDate, startPrice, endPrice, active, daysOfWeek, timeStart, timeEnd } = req.body;

    const priceChange = await PriceChange.findOne({
      id: priceChangeId,
      branchId: branchId
    });

    if (!priceChange) {
      return res.status(404).json({
        success: false,
        message: 'Price change not found in your branch'
      });
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
    }

    // Update fields
    const updateData = {};
    if (name) updateData.name = name;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (startPrice) updateData.originalPrice = parseFloat(startPrice);
    if (endPrice) {
      updateData.tempPrice = parseFloat(endPrice);
      updateData.value = parseFloat(endPrice);
    }
    if (active !== undefined) updateData.active = active;
    if (daysOfWeek !== undefined) updateData.daysOfWeek = daysOfWeek;
    if (timeStart !== undefined) updateData.timeStart = timeStart;
    if (timeEnd !== undefined) updateData.timeEnd = timeEnd;

    await PriceChange.updateOne(
      { _id: priceChange._id },
      { $set: updateData }
    );

    // Update product cache
    // await updateProductCache(priceChange.productId);

    res.status(200).json({
      success: true,
      message: 'Price change updated successfully',
      data: {
        priceChangeId: priceChange.id,
        productId: priceChange.productId,
        updated: updateData
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a price change
// @route   DELETE /api/price-changes/:id
// @access  Private (Admin/Manager/Staff)
exports.deletePriceChange = async (req, res, next) => {
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

    const priceChange = await PriceChange.findOne({
      id: priceChangeId,
      branchId: branchId
    });

    if (!priceChange) {
      return res.status(404).json({
        success: false,
        message: 'Price change not found in your branch'
      });
    }

    const productId = priceChange.productId;

    // Soft delete: mark as deleted instead of removing
    await PriceChange.updateOne(
      { _id: priceChange._id },
      { 
        $set: { 
          deleted: true, 
          deletedAt: new Date(),
          active: false // Also deactivate when deleted
        } 
      }
    );

    // Update product cache
    // await updateProductCache(productId);

    res.status(200).json({
      success: true,
      message: 'Price change deleted successfully',
      data: {
        priceChangeId: priceChange.id,
        productId: productId
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle price change active status
// @route   PATCH /api/price-changes/:id/toggle
// @access  Private (Admin/Manager/Staff)
exports.togglePriceChange = async (req, res, next) => {
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

    const priceChange = await PriceChange.findOne({
      id: priceChangeId,
      branchId: branchId
    });

    if (!priceChange) {
      return res.status(404).json({
        success: false,
        message: 'Price change not found in your branch'
      });
    }

    const newActiveStatus = !priceChange.active;

    await PriceChange.updateOne(
      { _id: priceChange._id },
      { $set: { active: newActiveStatus } }
    );

    // Update product cache
    // await updateProductCache(priceChange.productId);

    res.status(200).json({
      success: true,
      message: `Price change ${newActiveStatus ? 'activated' : 'deactivated'} successfully`,
      data: {
        priceChangeId: priceChange.id,
        productId: priceChange.productId,
        active: newActiveStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Revert expired price changes
// @route   POST /api/price-changes/revert-expired
// @access  Private (Admin/Manager/Staff)
exports.revertExpiredPriceChanges = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const branchId = req.user.branchId;
    const now = new Date();

    // Find expired price changes
    const expiredPriceChanges = await PriceChange.find({
      branchId: branchId,
      active: true,
      autoRevert: true,
      endDate: { $lt: now }
    });

    if (expiredPriceChanges.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No expired price changes found',
        data: {
          revertedProducts: 0
        }
      });
    }

    // Deactivate expired price changes
    const expiredIds = expiredPriceChanges.map(pc => pc._id);
    await PriceChange.updateMany(
      { _id: { $in: expiredIds } },
      { $set: { active: false } }
    );

    // Update product caches
    const productIds = [...new Set(expiredPriceChanges.map(pc => pc.productId))];
    for (const productId of productIds) {
      // await updateProductCache(productId);
    }

    res.status(200).json({
      success: true,
      message: `Reverted ${expiredPriceChanges.length} expired price changes`,
      data: {
        revertedProducts: expiredPriceChanges.length,
        revertedAt: now
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get effective prices for all products
// @route   GET /api/price-changes/effective-prices
// @access  Private (Admin/Manager/Staff)
exports.getEffectivePrices = async (req, res, next) => {
  try {
    const userRole = req.user ? req.user.role : null;
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const branchId = req.user.branchId;
    const { productIds } = req.query;

    let query = { branchId };
    if (productIds) {
      query._id = { $in: productIds.split(',') };
    }

    // Get all products with their cached effective prices
    const products = await Product.find(query)
      .select('name price currentEffectivePrice hasActivePriceChanges activePriceChangeId')
      .lean();

    const effectivePrices = products.map(product => ({
      id: product._id,
      name: product.name,
      originalPrice: product.price,
      effectivePrice: product.currentEffectivePrice || product.price,
      hasActivePriceChange: product.hasActivePriceChanges || false
    }));

    res.status(200).json({
      success: true,
      data: effectivePrices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get price changes list (legacy endpoint for compatibility)
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

    // Get all price changes grouped by price change ID
    const priceChanges = await PriceChange.find({ branchId })
      .populate('productId', 'name price')
      .sort({ startDate: -1 })
      .lean();

    // Group by price change name (for bulk operations)
    const priceChangesMap = new Map();

    priceChanges.forEach(priceChange => {
      const key = `${priceChange.name}_${priceChange.startDate}_${priceChange.endDate}`;
      
      if (!priceChangesMap.has(key)) {
        priceChangesMap.set(key, {
          id: priceChange.id,
          name: priceChange.name,
          type: priceChange.type || 'fixed',
          startDate: priceChange.startDate,
          endDate: priceChange.endDate,
          active: priceChange.active,
          autoRevert: priceChange.autoRevert || false,
          isExpired: new Date(priceChange.endDate) < new Date(),
          affectedProducts: []
        });
      }

      priceChangesMap.get(key).affectedProducts.push({
        id: priceChange.productId._id,
        name: priceChange.productId.name,
        originalPrice: priceChange.originalPrice,
        tempPrice: priceChange.tempPrice || priceChange.value,
        revertPrice: priceChange.revertPrice,
        currentActivePrice: priceChange.active ? priceChange.tempPrice : priceChange.originalPrice
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
const ProductAttributeItem = require('../models/product-attribute-item.model');
const Product = require('../models/product.model');
const Attribute = require('../models/attribute.model');
const { saveSingleFile, deleteFile } = require('../utils/fileUpload');

// @desc    Get all product attribute items
// @route   GET /api/product-attribute-items
// @access  Public
exports.getProductAttributeItems = async (req, res, next) => {
  try {
    let query = { isActive: true };
    
    // Filter by product if specified
    if (req.query.productId) {
      query.productId = req.query.productId;
    }

    // Filter by attribute if specified
    if (req.query.attributeId) {
      query.attributeId = req.query.attributeId;
    }

    // Search by name if specified
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }

    const items = await ProductAttributeItem.find(query)
      .populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection')
      .sort({ productId: 1, attributeId: 1, displayOrder: 1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product attribute item
// @route   GET /api/product-attribute-items/:id
// @access  Public
exports.getProductAttributeItem = async (req, res, next) => {
  try {
    const item = await ProductAttributeItem.findById(req.params.id)
      .populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Product attribute item not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product attribute item
// @route   POST /api/product-attribute-items
// @access  Public
exports.createProductAttributeItem = async (req, res, next) => {
  try {
    // Validate product exists
    if (req.body.productId) {
      const product = await Product.findById(req.body.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    }

    // Validate attribute exists
    if (req.body.attributeId) {
      const attribute = await Attribute.findById(req.body.attributeId);
      if (!attribute) {
        return res.status(404).json({
          success: false,
          message: 'Attribute not found'
        });
      }
    }

    // Handle image upload if present
    if (req.file) {
      const imagePath = await saveSingleFile(req.file, 'attribute-items');
      req.body.image = imagePath;
    }

    // Parse JSON strings if they exist
    if (typeof req.body.availability === 'string') {
      req.body.availability = JSON.parse(req.body.availability);
    }
    if (typeof req.body.allergens === 'string') {
      req.body.allergens = JSON.parse(req.body.allergens);
    }
    if (typeof req.body.stockManagement === 'string') {
      req.body.stockManagement = JSON.parse(req.body.stockManagement);
    }

    const item = await ProductAttributeItem.create(req.body);
    
    // Fetch the populated item to return
    const populatedItem = await ProductAttributeItem.findById(item._id)
      .populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection');

    res.status(201).json({
      success: true,
      data: populatedItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product attribute item
// @route   PUT /api/product-attribute-items/:id
// @access  Public
exports.updateProductAttributeItem = async (req, res, next) => {
  try {
    let item = await ProductAttributeItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Product attribute item not found with id of ${req.params.id}`
      });
    }

    // Validate product exists if being updated
    if (req.body.productId) {
      const product = await Product.findById(req.body.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    }

    // Validate attribute exists if being updated
    if (req.body.attributeId) {
      const attribute = await Attribute.findById(req.body.attributeId);
      if (!attribute) {
        return res.status(404).json({
          success: false,
          message: 'Attribute not found'
        });
      }
    }

    // Handle image upload if present
    if (req.file) {
      // Delete old image if exists
      if (item.image) {
        await deleteFile(item.image);
      }
      
      const imagePath = await saveSingleFile(req.file, 'attribute-items');
      req.body.image = imagePath;
    }

    // Parse JSON strings if they exist
    if (typeof req.body.availability === 'string') {
      req.body.availability = JSON.parse(req.body.availability);
    }
    if (typeof req.body.allergens === 'string') {
      req.body.allergens = JSON.parse(req.body.allergens);
    }
    if (typeof req.body.stockManagement === 'string') {
      req.body.stockManagement = JSON.parse(req.body.stockManagement);
    }

    item = await ProductAttributeItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection');

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product attribute item
// @route   DELETE /api/product-attribute-items/:id
// @access  Public
exports.deleteProductAttributeItem = async (req, res, next) => {
  try {
    const item = await ProductAttributeItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Product attribute item not found with id of ${req.params.id}`
      });
    }

    // Delete associated image
    if (item.image) {
      await deleteFile(item.image);
    }

    // Soft delete by setting isActive to false
    await ProductAttributeItem.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      data: {},
      message: 'Product attribute item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attribute items by product
// @route   GET /api/product-attribute-items/product/:productId
// @access  Public
exports.getAttributeItemsByProduct = async (req, res, next) => {
  try {
    const items = await ProductAttributeItem.find({ 
      productId: req.params.productId,
      isActive: true 
    })
      .populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection')
      .sort({ attributeId: 1, displayOrder: 1 });

    // Group items by attribute
    const groupedItems = items.reduce((acc, item) => {
      const attributeId = item.attributeId._id.toString();
      if (!acc[attributeId]) {
        acc[attributeId] = {
          attribute: item.attributeId,
          items: []
        };
      }
      acc[attributeId].items.push(item);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      count: items.length,
      data: Object.values(groupedItems)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attribute items by attribute
// @route   GET /api/product-attribute-items/attribute/:attributeId
// @access  Public
exports.getAttributeItemsByAttribute = async (req, res, next) => {
  try {
    const items = await ProductAttributeItem.find({ 
      attributeId: req.params.attributeId,
      isActive: true 
    })
      .populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection')
      .sort({ productId: 1, displayOrder: 1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create attribute items for product
// @route   POST /api/product-attribute-items/bulk
// @access  Public
exports.bulkCreateAttributeItems = async (req, res, next) => {
  try {
    const { productId, attributeId, items } = req.body;

    if (!productId || !attributeId || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'productId, attributeId, and items array are required'
      });
    }

    // Validate product and attribute exist
    const [product, attribute] = await Promise.all([
      Product.findById(productId),
      Attribute.findById(attributeId)
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: 'Attribute not found'
      });
    }

    // Prepare items for bulk creation
    const itemsToCreate = items.map((item, index) => ({
      ...item,
      productId,
      attributeId,
      displayOrder: item.displayOrder || index
    }));

    const createdItems = await ProductAttributeItem.insertMany(itemsToCreate);

    // Populate the created items
    const populatedItems = await ProductAttributeItem.find({
      _id: { $in: createdItems.map(item => item._id) }
    })
      .populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection');

    res.status(201).json({
      success: true,
      count: populatedItems.length,
      data: populatedItems
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update stock for attribute item
// @route   PUT /api/product-attribute-items/:id/stock
// @access  Public
exports.updateAttributeItemStock = async (req, res, next) => {
  try {
    const { quantity, operation = 'set' } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const item = await ProductAttributeItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Product attribute item not found'
      });
    }

    let newQuantity;
    switch (operation) {
      case 'add':
        newQuantity = item.stockManagement.quantity + quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, item.stockManagement.quantity - quantity);
        break;
      case 'set':
      default:
        newQuantity = quantity;
        break;
    }

    const updatedItem = await ProductAttributeItem.findByIdAndUpdate(
      req.params.id,
      {
        'stockManagement.quantity': newQuantity,
        'stockManagement.lastUpdated': new Date()
      },
      { new: true, runValidators: true }
    ).populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection');

    res.status(200).json({
      success: true,
      data: updatedItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Copy attributes from one product to another
// @route   POST /api/product-attribute-items/copy
// @access  Private (Admin only)
exports.copyAttributesBetweenProducts = async (req, res, next) => {
  try {
    const { sourceProductId, targetProductId, attributeIds } = req.body;

    console.log('Copy request:', { sourceProductId, targetProductId, attributeIds });

    if (!sourceProductId || !targetProductId) {
      return res.status(400).json({
        success: false,
        message: 'Source and target product IDs are required'
      });
    }

    // Validate products exist
    const [sourceProduct, targetProduct] = await Promise.all([
      Product.findById(sourceProductId),
      Product.findById(targetProductId)
    ]);

    console.log('Products found:', { 
      sourceProduct: sourceProduct ? sourceProduct.name : 'Not found',
      targetProduct: targetProduct ? targetProduct.name : 'Not found'
    });

    if (!sourceProduct) {
      return res.status(404).json({
        success: false,
        message: 'Source product not found'
      });
    }

    if (!targetProduct) {
      return res.status(404).json({
        success: false,
        message: 'Target product not found'
      });
    }

    // Get source product's attribute items
    let query = { productId: sourceProductId, isActive: true };
    if (attributeIds && attributeIds.length > 0) {
      query.attributeId = { $in: attributeIds };
    }

    console.log('Query for source attributes:', query);

    const sourceAttributeItems = await ProductAttributeItem.find(query);

    console.log('Source attribute items found:', sourceAttributeItems.length);
    console.log('Source attribute items:', sourceAttributeItems.map(item => ({
      id: item._id,
      name: item.name,
      attributeId: item.attributeId,
      productId: item.productId
    })));

    if (sourceAttributeItems.length === 0) {
      // Let's also check if there are ANY attribute items for this product
      const allItemsForProduct = await ProductAttributeItem.find({ productId: sourceProductId });
      console.log('All items for source product (including inactive):', allItemsForProduct.length);
      
      return res.status(404).json({
        success: false,
        message: 'No attribute items found for source product',
        debug: {
          sourceProductId,
          totalItemsForProduct: allItemsForProduct.length,
          activeItemsForProduct: sourceAttributeItems.length
        }
      });
    }

    // Remove existing attribute items for target product (for the same attributes)
    const attributesToCopy = [...new Set(sourceAttributeItems.map(item => item.attributeId.toString()))];
    await ProductAttributeItem.deleteMany({
      productId: targetProductId,
      attributeId: { $in: attributesToCopy }
    });

    // Create new attribute items for target product
    const itemsToCreate = sourceAttributeItems.map(item => ({
      productId: targetProductId,
      attributeId: item.attributeId,
      name: item.name,
      price: item.price,
      description: item.description,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      hiddenForToday: item.hiddenForToday || false,
      fullyHidden: item.fullyHidden || false,
      image: item.image,
      allergens: item.allergens,
      calorificValue: item.calorificValue,
      weight: item.weight,
      availability: item.availability,
      stockManagement: item.stockManagement
    }));

    const copiedItems = await ProductAttributeItem.insertMany(itemsToCreate);

    // Populate the copied items
    const populatedItems = await ProductAttributeItem.find({
      _id: { $in: copiedItems.map(item => item._id) }
    })
      .populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection');

    res.status(201).json({
      success: true,
      count: populatedItems.length,
      data: populatedItems,
      message: `Copied ${populatedItems.length} attribute items to target product`
    });
  } catch (error) {
    console.error('Error in copyAttributesBetweenProducts:', error);
    next(error);
  }
};

// @desc    Copy attributes from product to all products in category
// @route   POST /api/product-attribute-items/copy-to-category
// @access  Private (Admin only)
exports.copyAttributesToCategory = async (req, res, next) => {
  try {
    const { sourceProductId, categoryId, attributeIds } = req.body;

    if (!sourceProductId || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Source product ID and category ID are required'
      });
    }

    // Validate source product exists
    const sourceProduct = await Product.findById(sourceProductId);
    if (!sourceProduct) {
      return res.status(404).json({
        success: false,
        message: 'Source product not found'
      });
    }

    // Get all products in the category (excluding source product)
    const targetProducts = await Product.find({
      category: categoryId,
      _id: { $ne: sourceProductId },
      isActive: true
    });

    if (targetProducts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No target products found in category'
      });
    }

    // Get source product's attribute items
    let query = { productId: sourceProductId, isActive: true };
    if (attributeIds && attributeIds.length > 0) {
      query.attributeId = { $in: attributeIds };
    }

    const sourceAttributeItems = await ProductAttributeItem.find(query);

    if (sourceAttributeItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No attribute items found for source product'
      });
    }

    const attributesToCopy = [...new Set(sourceAttributeItems.map(item => item.attributeId.toString()))];
    let totalCopied = 0;

    // Copy to each target product
    for (const targetProduct of targetProducts) {
      // Remove existing attribute items for target product (for the same attributes)
      await ProductAttributeItem.deleteMany({
        productId: targetProduct._id,
        attributeId: { $in: attributesToCopy }
      });

      // Create new attribute items for target product
      const itemsToCreate = sourceAttributeItems.map(item => ({
        productId: targetProduct._id,
        attributeId: item.attributeId,
        name: item.name,
        price: item.price,
        description: item.description,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
        image: item.image,
        allergens: item.allergens,
        calorificValue: item.calorificValue,
        weight: item.weight,
        availability: item.availability,
        stockManagement: item.stockManagement
      }));

      await ProductAttributeItem.insertMany(itemsToCreate);
      totalCopied += itemsToCreate.length;
    }

    res.status(201).json({
      success: true,
      count: totalCopied,
      targetProducts: targetProducts.length,
      message: `Copied attributes to ${targetProducts.length} products in category`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update hidden status for attribute item
// @route   PATCH /api/product-attribute-items/:id/hidden-status
// @access  Private (Admin only)
exports.updateAttributeItemHiddenStatus = async (req, res, next) => {
  try {
    const { hiddenForToday, fullyHidden } = req.body;

    const item = await ProductAttributeItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Product attribute item not found'
      });
    }

    // Update hidden status with mutual exclusion logic
    const updateData = {};
    
    if (typeof hiddenForToday === 'boolean') {
      updateData.hiddenForToday = hiddenForToday;
      // If setting hiddenForToday to true, set fullyHidden to false
      if (hiddenForToday) {
        updateData.fullyHidden = false;
      }
    }
    
    if (typeof fullyHidden === 'boolean') {
      updateData.fullyHidden = fullyHidden;
      // If setting fullyHidden to true, set hiddenForToday to false
      if (fullyHidden) {
        updateData.hiddenForToday = false;
      }
    }

    const updatedItem = await ProductAttributeItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('productId', 'name price category')
      .populate('attributeId', 'name type requiresSelection');

    res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Hidden status updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attribute options for a specific attribute
// @route   GET /api/product-attribute-items/attribute/:attributeId/options
// @access  Public
exports.getAttributeOptions = async (req, res, next) => {
  try {
    const { attributeId } = req.params;
    const { productId } = req.query;

    // Validate attribute exists
    const attribute = await Attribute.findById(attributeId);
    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: 'Attribute not found'
      });
    }

    let query = { attributeId, isActive: true };
    if (productId) {
      query.productId = productId;
    }

    const options = await ProductAttributeItem.find(query)
      .populate('productId', 'name price category')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: options.length,
      data: options,
      attribute: {
        id: attribute._id,
        name: attribute.name,
        type: attribute.type,
        requiresSelection: attribute.requiresSelection
      }
    });
  } catch (error) {
    next(error);
  }
}; 
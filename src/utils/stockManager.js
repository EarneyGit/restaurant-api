const Product = require('../models/product.model');

/**
 * Check if sufficient stock is available for products in an order
 * @param {Array} orderItems - Array of {product: productId, quantity: number}
 * @returns {Object} - {success: boolean, errors: Array, stockInfo: Array}
 */
const checkStockAvailability = async (orderItems) => {
  const errors = [];
  const stockInfo = [];

  for (const item of orderItems) {
    try {
      const product = await Product.findById(item.product);
      
      if (!product) {
        errors.push({
          productId: item.product,
          error: 'Product not found'
        });
        continue;
      }

      const stockData = {
        productId: item.product,
        productName: product.name,
        isManaged: product.stockManagement?.isManaged || false,
        availableStock: product.stockManagement?.quantity || 0,
        requestedQuantity: item.quantity
      };

      // Only check stock for managed products
      if (product.stockManagement?.isManaged) {
        const availableStock = product.stockManagement.quantity || 0;
        
        if (availableStock < item.quantity) {
          errors.push({
            productId: item.product,
            productName: product.name,
            error: `Insufficient stock. Available: ${availableStock}, Requested: ${item.quantity}`
          });
        }
        
        stockData.isLowStock = availableStock <= product.stockManagement.lowStockThreshold;
      }

      stockInfo.push(stockData);

    } catch (error) {
      errors.push({
        productId: item.product,
        error: error.message
      });
    }
  }

  return {
    success: errors.length === 0,
    errors,
    stockInfo
  };
};

/**
 * Deduct stock for products in an order
 * @param {Array} orderItems - Array of {product: productId, quantity: number}
 * @returns {Object} - {success: boolean, errors: Array, updated: Array}
 */
const deductStock = async (orderItems) => {
  const errors = [];
  const updated = [];

  for (const item of orderItems) {
    try {
      const product = await Product.findById(item.product);
      
      if (!product) {
        errors.push({
          productId: item.product,
          error: 'Product not found'
        });
        continue;
      }

      // Only deduct stock for managed products
      if (product.stockManagement?.isManaged) {
        const updatedProduct = await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: { 'stockManagement.quantity': -item.quantity },
            'stockManagement.lastUpdated': new Date()
          },
          { new: true }
        );

        updated.push({
          productId: item.product,
          productName: updatedProduct.name,
          quantityDeducted: item.quantity,
          newStock: updatedProduct.stockManagement.quantity,
          isLowStock: updatedProduct.stockManagement.quantity <= updatedProduct.stockManagement.lowStockThreshold
        });
      }

    } catch (error) {
      errors.push({
        productId: item.product,
        error: error.message
      });
    }
  }

  return {
    success: errors.length === 0,
    errors,
    updated
  };
};

/**
 * Restore stock for products (for order cancellations)
 * @param {Array} orderItems - Array of {product: productId, quantity: number}
 * @returns {Object} - {success: boolean, errors: Array, restored: Array}
 */
const restoreStock = async (orderItems) => {
  const errors = [];
  const restored = [];

  for (const item of orderItems) {
    try {
      const product = await Product.findById(item.product);
      
      if (!product) {
        errors.push({
          productId: item.product,
          error: 'Product not found'
        });
        continue;
      }

      // Only restore stock for managed products
      if (product.stockManagement?.isManaged) {
        const updatedProduct = await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: { 'stockManagement.quantity': item.quantity },
            'stockManagement.lastUpdated': new Date()
          },
          { new: true }
        );

        restored.push({
          productId: item.product,
          productName: updatedProduct.name,
          quantityRestored: item.quantity,
          newStock: updatedProduct.stockManagement.quantity
        });
      }

    } catch (error) {
      errors.push({
        productId: item.product,
        error: error.message
      });
    }
  }

  return {
    success: errors.length === 0,
    errors,
    restored
  };
};

/**
 * Get low stock products
 * @param {Object} filters - {branchId, categoryId}
 * @returns {Array} - Array of products with low stock
 */
const getLowStockProducts = async (filters = {}) => {
  let query = {
    'stockManagement.isManaged': true,
    $expr: {
      $lte: ['$stockManagement.quantity', '$stockManagement.lowStockThreshold']
    }
  };

  if (filters.branchId) {
    query.branchId = filters.branchId;
  }

  if (filters.categoryId) {
    query.category = filters.categoryId;
  }

  const products = await Product.find(query)
    .populate('category', 'name')
    .populate('branchId', 'name')
    .select('name stockManagement category branchId')
    .sort('stockManagement.quantity');

  return products.map(product => ({
    id: product._id,
    name: product.name,
    category: product.category,
    branch: product.branchId,
    currentStock: product.stockManagement.quantity,
    threshold: product.stockManagement.lowStockThreshold,
    deficit: product.stockManagement.lowStockThreshold - product.stockManagement.quantity
  }));
};

module.exports = {
  checkStockAvailability,
  deductStock,
  restoreStock,
  getLowStockProducts
}; 
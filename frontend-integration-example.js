// Frontend Integration Example for Stock Management
// This file shows how to integrate with the stock management APIs

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Bulk update stock for multiple products
 * This function should be called when the user clicks "Save Changes" in the stock control page
 */
const bulkUpdateStock = async (productsData) => {
  try {
    // Transform frontend data to match API structure
    const products = productsData.map(product => ({
      id: product.id,
      isManaged: product.isManaged,
      quantity: product.quantity
    }));

    const response = await fetch(`${API_BASE_URL}/products/stock/bulk-update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ products })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`Successfully updated ${result.data.successCount} products`);
      if (result.data.errors.length > 0) {
        console.warn('Some products failed to update:', result.data.errors);
      }
      return result.data.updated;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error updating stock:', error);
    throw error;
  }
};

/**
 * Get all products with their stock information
 * This function should be called when loading the stock control page
 */
const getProductsWithStock = async (branchId = null, categoryId = null) => {
  try {
    let url = `${API_BASE_URL}/products`;
    const params = new URLSearchParams();
    
    if (branchId) params.append('branch', branchId);
    if (categoryId) params.append('category', categoryId);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      // Transform API data to match frontend structure
      return result.data.map(product => ({
        id: product.id,
        name: product.name,
        isManaged: product.stockManagement?.isManaged || false,
        quantity: product.stockManagement?.quantity || 0,
        lowStockThreshold: product.stockManagement?.lowStockThreshold || 10,
        isLowStock: product.stockManagement?.quantity <= product.stockManagement?.lowStockThreshold,
        category: product.category,
        lastUpdated: product.stockManagement?.lastUpdated
      }));
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

/**
 * Get stock status for all managed products
 * This can be used for monitoring low stock items
 */
const getStockStatus = async (branchId = null, lowStock = false) => {
  try {
    let url = `${API_BASE_URL}/products/stock/status`;
    const params = new URLSearchParams();
    
    if (branchId) params.append('branchId', branchId);
    if (lowStock) params.append('lowStock', 'true');
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error fetching stock status:', error);
    throw error;
  }
};

/**
 * Example implementation for the stock control page component
 */
const handleSaveChanges = async (categories) => {
  try {
    // Collect all products that have been modified
    const allProducts = [];
    
    categories.forEach(category => {
      category.items.forEach(item => {
        allProducts.push({
          id: item.id,
          isManaged: item.isManaged,
          quantity: item.quantity
        });
      });
    });

    // Call the bulk update API
    const updatedProducts = await bulkUpdateStock(allProducts);
    
    // Show success message
    console.log('Stock updated successfully:', updatedProducts);
    
    // Optionally refresh the data or show notifications
    // You might want to update the state with the returned data
    
  } catch (error) {
    console.error('Failed to save changes:', error);
    // Show error message to user
  }
};

/**
 * Example implementation for order creation with stock validation
 */
const createOrder = async (orderData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    if (result.success) {
      console.log('Order created successfully:', result.data);
      
      // Log stock deductions if any
      if (result.stockDeduction && result.stockDeduction.length > 0) {
        console.log('Stock deducted for managed products:', result.stockDeduction);
      }
      
      return result.data;
    } else {
      // Handle stock validation errors
      if (result.errors) {
        console.error('Stock validation failed:', result.errors);
      }
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

// Export functions for use in React components
export {
  bulkUpdateStock,
  getProductsWithStock,
  getStockStatus,
  handleSaveChanges,
  createOrder
}; 
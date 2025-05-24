const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const { checkStockAvailability, deductStock, restoreStock } = require('../utils/stockManager');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public/Private (Branch-based)
exports.getOrders = async (req, res, next) => {
  try {
    let query = {};
    let targetBranchId = null;
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    const isRegularUser = userRole === 'user' || userRole === null;
    
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
      
      // Admin can only see orders from their branch
      query.branchId = targetBranchId;
      
      // Regular users can only see their own orders when authenticated
      if (userRole === 'user') {
        query.user = req.user._id;
      }
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
      
      // If authenticated regular user, only show their orders
      if (isAuthenticated && isRegularUser) {
        query.user = req.user._id;
      } else if (!isAuthenticated) {
        // Guest users cannot see orders - return empty result
        return res.status(403).json({
          success: false,
          message: 'Authentication required to view orders'
        });
      }
    }

    // Additional filters for admin users only
    if (isAdmin) {
      // Filter today's orders if today=true
      if (req.query.today === 'true') {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));
        
        query.createdAt = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      }

      // Handle specific search parameters
      if (req.query.orderNumber) {
        query.orderNumber = { $regex: req.query.orderNumber, $options: 'i' };
      }

      if (req.query.userName) {
        const users = await User.find({
          name: { $regex: req.query.userName, $options: 'i' }
        }).select('_id');
        
        const userIds = users.map(user => user._id);
        query.user = { $in: userIds };
      }

      if (req.query.mobileNumber) {
        const users = await User.find({
          phone: { $regex: req.query.mobileNumber, $options: 'i' }
        }).select('_id');
        
        const userIds = users.map(user => user._id);
        query.user = { $in: userIds };
      }

      if (req.query.postCode) {
        query['deliveryAddress.postalCode'] = { $regex: req.query.postCode, $options: 'i' };
      }
      
      // Other filters
      if (req.query.status) {
        query.status = req.query.status;
      }
      
      if (req.query.startDate && req.query.endDate) {
        query.createdAt = {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate)
        };
      }
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('branchId', 'name address')
      .populate('products.product', 'name price')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
      branchId: targetBranchId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Public/Private (Branch-based)
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('branchId', 'name address')
      .populate('products.product', 'name price')
      .populate('assignedTo', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }
    
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    const isRegularUser = userRole === 'user' || userRole === null;
    
    // Handle access control based on user type
    if (isAdmin) {
      // Admin users: Check if order belongs to their branch
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      
      if (order.branchId._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this order'
        });
      }
      
      // Regular users can only view their own orders
      if (userRole === 'user' && order.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this order'
        });
      }
    } else {
      // Regular users and guests: Check branch and ownership
      const requestedBranchId = req.query.branchId;
      
      if (!requestedBranchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required. Please select a branch.'
        });
      }
      
      // Check if order belongs to the requested branch
      if (order.branchId._id.toString() !== requestedBranchId) {
        return res.status(403).json({
          success: false,
          message: 'Order not found in the selected branch'
        });
      }
      
      // Authentication and ownership check
      if (!isAuthenticated) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to view orders'
        });
      }
      
      // Regular users can only view their own orders
      if (isRegularUser && order.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this order'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Public/Private (Branch-based)
exports.createOrder = async (req, res, next) => {
  try {
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    const isRegularUser = userRole === 'user' || userRole === null;
    
    let targetBranchId = null;
    
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
      req.body.branchId = targetBranchId; // Override any provided branchId
    } else {
      // Regular users and guests: Use branch from request body
      if (!req.body.branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required. Please select a branch.'
        });
      }
      targetBranchId = req.body.branchId;
    }
    
    // Set user if authenticated
    if (isAuthenticated) {
      req.body.user = req.user._id;
    }
    
    // Verify products exist and belong to the specified branch
    if (!req.body.products || !Array.isArray(req.body.products) || req.body.products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products are required'
      });
    }
    
    // Validate product IDs and check branch assignment
    const validatedProducts = [];
    
    for (let i = 0; i < req.body.products.length; i++) {
      const item = req.body.products[i];
      
      if (!item.product || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: 'Product ID and quantity are required for each item'
        });
      }
      
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found with id of ${item.product}`
        });
      }
      
      if (product.branchId.toString() !== targetBranchId.toString()) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} does not belong to the selected branch`
        });
      }
      
      // Add product price to order item
      validatedProducts.push({
        product: item.product,
        quantity: item.quantity,
        price: product.price,
        notes: item.notes,
        selectedAttributes: item.selectedAttributes || []
      });
    }

    // Check stock availability for all products
    const stockCheck = await checkStockAvailability(validatedProducts);
    
    if (!stockCheck.success) {
      return res.status(400).json({
        success: false,
        message: 'Stock validation failed',
        errors: stockCheck.errors,
        stockInfo: stockCheck.stockInfo
      });
    }

    // Update the products array with validated data
    req.body.products = validatedProducts;

    // Create the order
    const order = await Order.create(req.body);

    // Deduct stock for managed products after successful order creation
    const stockDeduction = await deductStock(validatedProducts);
    
    // Populate order data for response
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone')
      .populate('branchId', 'name address')
      .populate('products.product', 'name price')
      .populate('assignedTo', 'name email');

    res.status(201).json({
      success: true,
      data: populatedOrder,
      stockDeduction: stockDeduction.updated,
      branchId: targetBranchId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private (Admin/Manager/Staff only)
exports.updateOrder = async (req, res, next) => {
  try {
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Only admin users can update orders
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update orders'
      });
    }
    
    // Admin users: Check if order belongs to their branch
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    if (order.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update orders from other branches'
      });
    }

    const oldStatus = order.status;
    const newStatus = req.body.status;

    // If order is being cancelled, restore stock
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      const stockRestoration = await restoreStock(order.products);
      
      // Update with full body
      order = await Order.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      }).populate('user', 'name email')
        .populate('branchId', 'name address')
        .populate('products.product', 'name price')
        .populate('assignedTo', 'name email');

      res.status(200).json({
        success: true,
        data: order,
        stockRestoration: stockRestoration.restored
      });
    } else {
      // Update with full body (no stock changes)
      order = await Order.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      }).populate('user', 'name email')
        .populate('branchId', 'name address')
        .populate('products.product', 'name price')
        .populate('assignedTo', 'name email');

      res.status(200).json({
        success: true,
        data: order
      });
    }

  } catch (error) {
    next(error);
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Public (temporarily)
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }

    await order.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user orders
// @route   GET /api/orders/myorders
// @access  Private (Authenticated users only)
exports.getMyOrders = async (req, res, next) => {
  try {
    // Authentication required
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Determine user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    let targetBranchId = null;
    
    let query = { user: req.user._id };
    
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
      // Regular users: Use branch from query parameter
      if (!req.query.branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch ID is required. Please select a branch.'
        });
      }
      targetBranchId = req.query.branchId;
      query.branchId = targetBranchId;
    }
    
    const orders = await Order.find(query)
      .populate('branchId', 'name address')
      .populate('products.product', 'name price')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
      branchId: targetBranchId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's orders
// @route   GET /api/orders/today
// @access  Private (Admin only)
exports.getTodayOrders = async (req, res, next) => {
  try {
    // Authentication required
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Determine user role
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Only admin users can access today's orders
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access today\'s orders'
      });
    }
    
    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    // Initialize query with date filter and branch filter
    let query = {
      branchId: req.user.branchId,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    };
    
    // Apply status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    const orders = await Order.find(query)
      .populate('user', 'name email')
      .populate('branchId', 'name address')
      .populate('products.product', 'name price')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
      branchId: req.user.branchId
    });
  } catch (error) {
    next(error);
  }
}; 
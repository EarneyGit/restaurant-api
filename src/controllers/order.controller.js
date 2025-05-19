const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public (temporarily)
exports.getOrders = async (req, res, next) => {
  try {
    let query = {};
    
    // Temporarily removed role-based filtering
    /*
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Regular users can only see their own orders
    if (!userRole || userRole === 'user') {
      query.user = req.user._id;
    }
    
    // For manager/staff, only show orders from their branch
    if (userRole === 'manager' || userRole === 'staff') {
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      query.branchId = req.user.branchId;
    }
    */
    
    // Filter by branch if specified
    if (req.query.branch) {
      query.branchId = req.query.branch;
    }

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

    // Search functionality
    if (req.query.searchText) {
      // First, find users matching the search criteria
      const users = await User.find({
        $or: [
          { name: { $regex: req.query.searchText, $options: 'i' } },
          { phone: { $regex: req.query.searchText, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(user => user._id);

      // Add search conditions to the query
      const searchQuery = {
        $or: [
          { orderNumber: { $regex: req.query.searchText, $options: 'i' } },
          { user: { $in: userIds } },
          { 'deliveryAddress.postalCode': { $regex: req.query.searchText, $options: 'i' } }
        ]
      };

      // Combine with existing query using $and to maintain other filters
      query = {
        $and: [
          query,
          searchQuery
        ]
      };
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

    const orders = await Order.find(query)
      .populate('user', 'name email phone')  // Added phone to user population
      .populate('branchId', 'name address')
      .populate('products.product', 'name price')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Public (temporarily)
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
    
    // Temporarily removed role-based access control
    /*
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, check if order belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        order.branchId && 
        req.user.branchId && 
        order.branchId._id.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
    // Regular users can only view their own orders
    if ((!userRole || userRole === 'user') && order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }
    */

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
// @access  Public (temporarily)
exports.createOrder = async (req, res, next) => {
  try {
    // Temporarily removed user assignment
    // req.body.user = req.user._id;
    
    // Validate branch assignment
    if (!req.body.branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }
    
    // Verify products exist and belong to the specified branch
    if (!req.body.products || !Array.isArray(req.body.products) || req.body.products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products are required'
      });
    }
    
    // Validate product IDs and check branch assignment
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
      
      if (product.branchId.toString() !== req.body.branchId.toString()) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} does not belong to the specified branch`
        });
      }
      
      if (!product.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not available`
        });
      }
      
      // Add product price to order item
      req.body.products[i].price = product.price;
    }

    const order = await Order.create(req.body);

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Public (temporarily)
exports.updateOrder = async (req, res, next) => {
  try {
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }

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
      data: order
    });
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
// @access  Public (temporarily)
exports.getMyOrders = async (req, res, next) => {
  try {
    // Temporarily removed user filtering
    const orders = await Order.find()
      .populate('branchId', 'name address')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's orders
// @route   GET /api/orders/today
// @access  Public (temporarily)
exports.getTodayOrders = async (req, res, next) => {
  try {
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    // Initialize query with date filter
    let query = {
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
      data: orders
    });
  } catch (error) {
    next(error);
  }
}; 
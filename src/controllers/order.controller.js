const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (with role-based filtering)
exports.getOrders = async (req, res, next) => {
  try {
    let query = {};
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Regular users can only see their own orders
    if (!userRole || userRole === 'user') {
      query.user = req.user._id;
    }
    
    // Filter by branch if specified
    if (req.query.branch) {
      query.branchId = req.query.branch;
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
    
    // For admin, show all orders unless filtered

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

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private (with role-based access control)
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
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    // Add user to request body
    req.body.user = req.user._id;
    
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
    
    // Auto-assign based on branch
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // If staff or manager is creating the order, auto-assign to them
    if ((userRole === 'staff' || userRole === 'manager') && 
        req.user.branchId && 
        req.user.branchId.toString() === req.body.branchId.toString()) {
      req.body.assignedTo = req.user._id;
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
// @access  Private/Admin/Manager/Staff
exports.updateOrder = async (req, res, next) => {
  try {
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Regular users can't update orders
    if (!userRole || userRole === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update orders'
      });
    }
    
    // For manager/staff, check if order belongs to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        order.branchId && 
        req.user.branchId && 
        order.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this order'
      });
    }
    
    // Prevent changing branchId for all users
    if (req.body.branchId && req.body.branchId.toString() !== order.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to change branch assignment'
      });
    }
    
    // Staff can only update status and assignedTo fields
    if (userRole === 'staff') {
      // Create a filtered body with only allowed fields
      const allowedFields = ['status', 'assignedTo'];
      const filteredBody = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          filteredBody[field] = req.body[field];
        }
      }
      
      // Validate assignment to same branch
      if (filteredBody.assignedTo) {
        const assignee = await User.findById(filteredBody.assignedTo);
        if (!assignee) {
          return res.status(404).json({
            success: false,
            message: 'Assignee not found'
          });
        }
        
        // Check if assignee belongs to the same branch
        if (!assignee.branchId || assignee.branchId.toString() !== req.user.branchId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Can only assign to staff in the same branch'
          });
        }
      }
      
      // Update with filtered body
      order = await Order.findByIdAndUpdate(req.params.id, filteredBody, {
        new: true,
        runValidators: true
      }).populate('user', 'name email')
        .populate('branchId', 'name address')
        .populate('products.product', 'name price')
        .populate('assignedTo', 'name email');
    } else {
      // For admin/manager - allow full update
      order = await Order.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      }).populate('user', 'name email')
        .populate('branchId', 'name address')
        .populate('products.product', 'name price')
        .populate('assignedTo', 'name email');
    }

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
// @access  Private/Admin/Manager
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot delete orders
    if (!userRole || userRole === 'user' || userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete orders'
      });
    }
    
    // For manager, check if order belongs to their branch
    if (userRole === 'manager' && 
        order.branchId && 
        req.user.branchId && 
        order.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this order'
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
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
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
// @access  Private/Admin/Manager/Staff
exports.getTodayOrders = async (req, res, next) => {
  try {
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Regular users can't access this endpoint
    if (!userRole || userRole === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access today\'s orders'
      });
    }
    
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
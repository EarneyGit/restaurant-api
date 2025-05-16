const Order = require('../models/order.model');
const Product = require('../models/product.model');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res, next) => {
  try {
    let query = {};
    
    // Allow filtering by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Allow filtering by user
    if (req.query.user) {
      query.user = req.query.user;
    }
    
    // Only return user's orders if not admin or manager
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.user = req.user._id;
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Order.countDocuments(query);
    
    const orders = await Order.find(query)
      .populate('user', 'name email')
      .populate('items.product', 'name image')
      .sort('-createdAt')
      .skip(startIndex)
      .limit(limit);
    
    // Pagination result
    const pagination = {};
    
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    res.status(200).json({
      success: true,
      count: orders.length,
      pagination,
      totalPages: Math.ceil(total / limit),
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product', 'name image')
      .populate('branch', 'name address')
      .populate('staff', 'name');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }
    
    // Make sure user is the order owner or an admin/manager
    if (
      order.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' && 
      req.user.role !== 'manager'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this order'
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
    const { 
      items,
      totalAmount,
      paymentMethod,
      deliveryMethod,
      deliveryAddress,
      deliveryFee,
      tax,
      discount,
      notes,
      branch
    } = req.body;
    
    // Validate order items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one item to the order'
      });
    }
    
    // Create order object
    const order = new Order({
      user: req.user._id,
      items,
      totalAmount,
      paymentMethod,
      deliveryMethod,
      deliveryAddress,
      deliveryFee,
      tax,
      discount,
      notes,
      branch
    });
    
    // Set staff if role is admin, manager, or staff
    if (['admin', 'manager', 'staff'].includes(req.user.role)) {
      order.staff = req.user._id;
    }
    
    // Calculate estimated delivery time
    if (deliveryMethod === 'delivery') {
      const deliveryMinutes = 30; // Default delivery time
      const estimatedTime = new Date();
      estimatedTime.setMinutes(estimatedTime.getMinutes() + deliveryMinutes);
      order.estimatedDeliveryTime = estimatedTime;
    }
    
    // Save the order
    const savedOrder = await order.save();
    
    res.status(201).json({
      success: true,
      data: savedOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin/Manager
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    let order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }
    
    // Only admin, manager, or assigned staff can update status
    if (
      req.user.role !== 'admin' && 
      req.user.role !== 'manager' &&
      (!order.staff || order.staff.toString() !== req.user._id.toString())
    ) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update this order'
      });
    }
    
    // Update status
    order.status = status;
    
    // If order is completed, update payment status if it was pending
    if (status === 'completed' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }
    
    // If order is cancelled, update payment status if it was pending
    if (status === 'cancelled' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'failed';
    }
    
    await order.save();
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order payment status
// @route   PUT /api/orders/:id/payment
// @access  Private/Admin/Manager
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    
    // Validate payment status
    const validStatuses = ['pending', 'paid', 'failed'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status value'
      });
    }
    
    let order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`
      });
    }
    
    // Only admin or manager can update payment status
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update payment status'
      });
    }
    
    // Update payment status
    order.paymentStatus = paymentStatus;
    
    await order.save();
    
    res.status(200).json({
      success: true,
      data: order
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
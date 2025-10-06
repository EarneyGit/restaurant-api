const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Reservation = require('../models/reservation.model');
const Category = require('../models/category.model');
const Branch = require('../models/branch.model');

// Helper function to get date range
const getDateRange = (period, customStart, customEnd) => {
  const today = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(today.setHours(0, 0, 0, 0));
      endDate = new Date(today.setHours(23, 59, 59, 999));
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.setHours(0, 0, 0, 0));
      endDate = new Date(yesterday.setHours(23, 59, 59, 999));
      break;
    case 'week':
      startDate = new Date(today.setDate(today.getDate() - 7));
      endDate = new Date();
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      startDate = customStart ? new Date(customStart) : new Date(today.setDate(today.getDate() - 30));
      endDate = customEnd ? new Date(customEnd) : new Date();
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate = new Date(today.setDate(today.getDate() - 30));
      endDate = new Date();
  }

  return { startDate, endDate };
};

// @desc    Get end of night report
// @route   GET /api/reports/end-of-night
// @access  Private/Staff or higher
exports.getEndOfNightReport = async (req, res, next) => {
  try {
    const { date, branchId } = req.query;
    const reportDate = date ? new Date(date) : new Date();
    
    // Set date range for the specific day
    const startDate = new Date(reportDate.setHours(0, 0, 0, 0));
    const endDate = new Date(reportDate.setHours(23, 59, 59, 999));
    
    // Build filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'delivered'] }
    };
    
    // Handle branch filtering based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, restrict to their branch only
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    // Get sales summary
    const salesSummary = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$total' },
          totalTips: { $sum: '$tips' },
          totalDeliveryFees: { $sum: '$deliveryFee' },
          averageOrderValue: { $avg: '$total' },
          cashOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, 1, 0] } },
          cardOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, 1, 0] } },
          deliveryOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'delivery'] }, 1, 0] } },
          pickupOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'pickup'] }, 1, 0] } },
          dineInOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'dine-in'] }, 1, 0] } }
        }
      }
    ]);

    // Get top selling items for the day
    const topItems = await Order.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.priceAtTime', '$items.quantity'] } }
        }
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 }
    ]);

    // Get hourly sales breakdown
    const hourlySales = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          orders: { $sum: 1 },
          sales: { $sum: '$total' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        date: reportDate.toISOString().split('T')[0],
        summary: salesSummary[0] || {
          totalOrders: 0,
          totalSales: 0,
          totalTips: 0,
          totalDeliveryFees: 0,
          averageOrderValue: 0,
          cashOrders: 0,
          cardOrders: 0,
          deliveryOrders: 0,
          pickupOrders: 0,
          dineInOrders: 0
        },
        topItems,
        hourlySales
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get end of month report
// @route   GET /api/reports/end-of-month
// @access  Private/Staff or higher
exports.getEndOfMonthReport = async (req, res, next) => {
  try {
    const { month, year, branchId } = req.query;
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    const reportMonth = month ? parseInt(month) - 1 : new Date().getMonth(); // Month is 0-indexed
    
    const startDate = new Date(reportYear, reportMonth, 1);
    const endDate = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59, 999);
    
    // Build filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'delivered'] }
    };
    
    // Handle branch filtering based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, restrict to their branch only
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    // Monthly summary
    const monthlySummary = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$total' },
          totalTips: { $sum: '$tips' },
          totalDeliveryFees: { $sum: '$deliveryFee' },
          averageOrderValue: { $avg: '$total' },
          uniqueCustomers: { $addToSet: '$customerId' }
        }
      },
      {
        $project: {
          totalOrders: 1,
          totalSales: 1,
          totalTips: 1,
          totalDeliveryFees: 1,
          averageOrderValue: 1,
          uniqueCustomers: { $size: '$uniqueCustomers' }
        }
      }
    ]);

    // Daily breakdown
    const dailyBreakdown = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          orders: { $sum: 1 },
          sales: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      },
      { $sort: { '_id.day': 1 } }
    ]);

    // Top customers
    const topCustomers = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$customerId',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $project: {
          totalOrders: 1,
          totalSpent: 1,
          customerName: { $arrayElemAt: ['$customer.name', 0] },
          customerEmail: { $arrayElemAt: ['$customer.email', 0] }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        period: `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`,
        summary: monthlySummary[0] || {
          totalOrders: 0,
          totalSales: 0,
          totalTips: 0,
          totalDeliveryFees: 0,
          averageOrderValue: 0,
          uniqueCustomers: 0
        },
        dailyBreakdown,
        topCustomers
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales history
// @route   GET /api/reports/sales-history
// @access  Private/Staff or higher
exports.getSalesHistory = async (req, res, next) => {
  try {
    const { startDate: start, endDate: end, branchId, page = 1, limit = 50 } = req.query;
    
    // Date range
    const { startDate, endDate } = getDateRange('custom', start, end);
    
    // Build filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate }
    };
    
    // Handle branch filtering based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, restrict to their branch only
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get orders with customer details
    const orders = await Order.find(filter)
      .populate("customerId", "firstName lastName email phone")
      .populate("branchId", " _id name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Transform data to match frontend interface
    const salesData = orders.map(order => {
      // Format date to DD/MM/YYYY
      const date = new Date(order.createdAt);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      
      return {
        id: order._id.toString(),
        branchId: order.branchId._id.toString(),
        branchName: order.branchId.name,
        customer:
          order.customerId?.firstName + " " + order.customerId?.lastName ||
          "Guest",
        email: order.customerId?.email || "N/A",
        orderNumber: order.orderNumber || "N/A",
        status: order.status,
        total: order.total || 0,
        discount: order.discount || 0,
        postcode:
          order.deliveryAddress?.zipCode ||
          order.deliveryAddress?.postalCode ||
          "N/A",
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderType: order.orderType,
        deliveryAddress: order.deliveryAddress,
        created: formattedDate,
      };
    });

    // Get total count for pagination
    const totalCount = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: salesData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales of item history
// @route   GET /api/reports/item-sales-history
// @access  Private/Staff or higher
exports.getItemSalesHistory = async (req, res, next) => {
  try {
    const { startDate: start, endDate: end, productId, categoryId, page = 1, limit = 50, branchId } = req.query;
    
    // Date range
    const { startDate, endDate } = getDateRange('custom', start, end);
    
    // Build filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'delivered'] }
    };
    
    // Handle branch filtering based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, restrict to their branch only
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: filter },
      { $unwind: '$items' }
    ];

    // Add product filter if specified
    if (productId) {
      pipeline.push({ $match: { 'items.productId': productId } });
    }

    // Add category filter if specified
    if (categoryId) {
      pipeline.push({
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      });
      pipeline.push({ $match: { 'product.category': categoryId } });
    }

    // Group and sort
    pipeline.push(
      {
        $group: {
          _id: {
            productId: '$items.productId',
            name: '$items.name',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            }
          },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.priceAtTime', '$items.quantity'] } }
        }
      },
      { $sort: { '_id.date': -1, 'quantity': -1 } }
    );

    // Add pagination
    pipeline.push(
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    const itemSales = await Order.aggregate(pipeline);

    // Transform data to match frontend interface
    const itemSalesData = itemSales.map(item => ({
      id: item._id.productId.toString(),
      name: item._id.name,
      quantity: item.quantity,
      created: item._id.date
    }));

    res.status(200).json({
      success: true,
      data: itemSalesData,
      pagination: {
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get discount history
// @route   GET /api/reports/discount-history
// @access  Private/Staff or higher
exports.getDiscountHistory = async (req, res, next) => {
  try {
    const { startDate: start, endDate: end, discountType, page = 1, limit = 50, branchId } = req.query;
    
    // Date range
    const { startDate, endDate } = getDateRange('custom', start, end);
    
    // Build filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      $or: [
        { 'discount.discountAmount': { $gt: 0 } },
        { 'discountApplied.discountAmount': { $gt: 0 } }
      ]
    };
    
    // Handle branch filtering based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, restrict to their branch only
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    // Add discount type filter if specified
    if (discountType && discountType !== 'all') {
      filter.discountType = discountType;
    }

    // Get orders with discounts
    const orders = await Order.find(filter)
      .populate('customerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // Transform data to match frontend interface
    const discountData = orders.map(order => {
      // Get discount info from either discount or discountApplied field
      const discountInfo = order.discountApplied || order.discount || {};
      const discountName = discountInfo.name || discountInfo.code || order.discountType || 'General';
      const discountAmount = discountInfo.discountAmount || order.discount || 0;
      
      return {
        id: order._id.toString(),
        orderNumber: order.orderNumber || 'N/A',
        customer: order.customerId?.firstName + ' ' + order.customerId?.lastName || 'Guest',
        discount: discountName,
        value: discountAmount,
        date: order.createdAt.toISOString()
      };
    });

    // Get total count
    const totalCount = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: discountData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get outlet/branch reports
// @route   GET /api/reports/outlet-reports
// @access  Private/Staff or higher
exports.getOutletReports = async (req, res, next) => {
  try {
    const { branchId, period = 'month' } = req.query;
    
    // Handle branch based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, use their branch
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (!effectiveBranchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Date range
    const { startDate, endDate } = getDateRange(period);
    
    // Get branch details
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Build filter
    const filter = {
      branchId: effectiveBranchId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'delivered'] }
    };

    // Outlet summary
    const outletSummary = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          totalCustomers: { $addToSet: '$customerId' }
        }
      },
      {
        $project: {
          totalOrders: 1,
          totalSales: 1,
          averageOrderValue: 1,
          totalCustomers: { $size: '$totalCustomers' }
        }
      }
    ]);

    // Order type breakdown
    const orderTypeBreakdown = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$orderType',
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      }
    ]);

    // Top selling products for this outlet
    const topProducts = await Order.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.priceAtTime', '$items.quantity'] } }
        }
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        branch: {
          id: branch._id,
          name: branch.name,
          address: branch.address
        },
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        summary: outletSummary[0] || {
          totalOrders: 0,
          totalSales: 0,
          averageOrderValue: 0,
          totalCustomers: 0
        },
        orderTypeBreakdown,
        topProducts
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get custom reports
// @route   GET /api/reports/custom
// @access  Private/Staff or higher
exports.getCustomReports = async (req, res, next) => {
  try {
    const { type, startDate: start, endDate: end, branchId } = req.query;
    
    // Date range
    const { startDate, endDate } = getDateRange('custom', start, end);
    
    // Build base filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'delivered'] }
    };
    
    // Handle branch filtering based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, restrict to their branch only
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    let reportData = {};

    switch (type) {
      case 'menu-category-totals':
        reportData = await Order.aggregate([
          { $match: filter },
          { $unwind: '$items' },
          {
            $lookup: {
              from: 'products',
              localField: 'items.productId',
              foreignField: '_id',
              as: 'product'
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'product.category',
              foreignField: '_id',
              as: 'category'
            }
          },
          {
            $group: {
              _id: {
                categoryId: { $arrayElemAt: ['$category._id', 0] },
                categoryName: { $arrayElemAt: ['$category.name', 0] }
              },
              totalQuantity: { $sum: '$items.quantity' },
              totalRevenue: { $sum: { $multiply: ['$items.priceAtTime', '$items.quantity'] } }
            }
          },
          { $sort: { totalRevenue: -1 } }
        ]);
        break;

      case 'daily-totals':
        reportData = await Order.aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              totalOrders: { $sum: 1 },
              totalSales: { $sum: '$total' },
              averageOrderValue: { $avg: '$total' }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        break;

      case 'order-export':
        const exportData = await Order.find(filter)
          .populate('customerId', 'name email phone')
          .populate('branchId', 'name')
          .sort({ createdAt: -1 })
          .lean();

        reportData = exportData.map(order => ({
          orderId: order._id.toString(),
          customerName: order.customerId?.name || 'Guest',
          customerEmail: order.customerId?.email || 'N/A',
          orderType: order.orderType,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          subtotal: order.subtotal,
          tax: order.tax,
          deliveryFee: order.deliveryFee,
          discount: order.discount,
          tips: order.tips,
          total: order.total,
          branchName: order.branchId?.name || 'N/A',
          createdAt: order.createdAt,
          items: order.items
        }));
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type. Choose from: menu-category-totals, daily-totals, order-export'
        });
    }

    res.status(200).json({
      success: true,
      type,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      data: reportData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard summary metrics
// @route   GET /api/reports/dashboard-summary
// @access  Private/Staff or higher
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const { period = 'today', branchId } = req.query;
    
    // Date range
    const { startDate, endDate } = getDateRange(period);
    
    // Build filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'delivered'] }
    };
    
    // Handle branch filtering based on user role
    let effectiveBranchId = branchId;
    
    // If user is staff/manager, restrict to their branch only
    if (req.user.role === 'staff' || req.user.role === 'manager') {
      effectiveBranchId = req.user.branchId;
    }
    
    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    // Current period metrics
    const currentMetrics = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          totalCustomers: { $addToSet: '$customerId' }
        }
      },
      {
        $project: {
          totalOrders: 1,
          totalSales: 1,
          averageOrderValue: 1,
          totalCustomers: { $size: '$totalCustomers' }
        }
      }
    ]);
    
    // Previous period for comparison
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(endDate);
    const periodDiff = endDate - startDate;
    previousStartDate.setTime(previousStartDate.getTime() - periodDiff);
    previousEndDate.setTime(previousEndDate.getTime() - periodDiff);

    const previousFilter = {
      ...filter,
      createdAt: { $gte: previousStartDate, $lte: previousEndDate }
    };

    const previousMetrics = await Order.aggregate([
      { $match: previousFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          totalCustomers: { $addToSet: '$customerId' }
        }
      },
      {
        $project: {
          totalOrders: 1,
          totalSales: 1,
          averageOrderValue: 1,
          totalCustomers: { $size: '$totalCustomers' }
        }
      }
    ]);
    
    const current = currentMetrics[0] || { totalOrders: 0, totalSales: 0, averageOrderValue: 0, totalCustomers: 0 };
    const previous = previousMetrics[0] || { totalOrders: 0, totalSales: 0, averageOrderValue: 0, totalCustomers: 0 };

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const summary = [
      {
        label: 'Total Sales',
        value: current.totalSales.toFixed(2),
        previousValue: previous.totalSales.toFixed(2),
        percentageChange: calculatePercentageChange(current.totalSales, previous.totalSales),
        prefix: '£'
      },
      {
        label: 'Total Orders',
        value: current.totalOrders,
        previousValue: previous.totalOrders,
        percentageChange: calculatePercentageChange(current.totalOrders, previous.totalOrders)
      },
      {
        label: 'Average Order Value',
        value: current.averageOrderValue.toFixed(2),
        previousValue: previous.averageOrderValue.toFixed(2),
        percentageChange: calculatePercentageChange(current.averageOrderValue, previous.averageOrderValue),
        prefix: '£'
      },
      {
        label: 'Customers',
        value: current.totalCustomers,
        previousValue: previous.totalCustomers,
        percentageChange: calculatePercentageChange(current.totalCustomers, previous.totalCustomers)
      }
    ];
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
}; 
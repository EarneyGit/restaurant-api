const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Reservation = require('../models/reservation.model');

// @desc    Get sales reports
// @route   GET /api/reports/sales
// @access  Private/Admin/Manager
exports.getSalesReport = async (req, res, next) => {
  try {
    // Parse date range from query
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Filter by branch if provided
    const branchFilter = req.query.branch ? { branch: req.query.branch } : {};
    
    // Aggregate sales data
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
          paymentStatus: 'paid',
          ...branchFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1
        }
      }
    ]);
    
    // Calculate totals
    const totalSales = salesData.reduce((sum, day) => sum + day.totalSales, 0);
    const totalOrders = salesData.reduce((sum, day) => sum + day.orderCount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    res.status(200).json({
      success: true,
      data: {
        salesByDay: salesData,
        summary: {
          totalSales,
          totalOrders,
          averageOrderValue,
          period: {
            startDate,
            endDate
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top selling products
// @route   GET /api/reports/products/top
// @access  Private/Admin/Manager
exports.getTopProducts = async (req, res, next) => {
  try {
    // Parse date range from query
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Limit number of products to return
    const limit = parseInt(req.query.limit, 10) || 10;
    
    // Aggregate top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          totalQuantity: 1,
          totalRevenue: 1,
          product: { $arrayElemAt: ['$productDetails', 0] }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      count: topProducts.length,
      data: topProducts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer statistics
// @route   GET /api/reports/customers
// @access  Private/Admin
exports.getCustomerStats = async (req, res, next) => {
  try {
    // Get total customers
    const totalCustomers = await User.countDocuments({ role: 'user' });
    
    // Get new customers this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newCustomers = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: startOfMonth }
    });
    
    // Get top customers by order value
    const topCustomers = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalSpent: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $project: {
          _id: 1,
          totalSpent: 1,
          orderCount: 1,
          user: { $arrayElemAt: ['$userDetails', 0] }
        }
      },
      {
        $project: {
          _id: 1,
          totalSpent: 1,
          orderCount: 1,
          'user.name': 1,
          'user.email': 1
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        newCustomers,
        topCustomers
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reservation statistics
// @route   GET /api/reports/reservations
// @access  Private/Admin/Manager
exports.getReservationStats = async (req, res, next) => {
  try {
    // Parse date range from query
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Filter by branch if provided
    const branchFilter = req.query.branch ? { branch: req.query.branch } : {};
    
    // Get reservation count by status
    const reservationsByStatus = await Reservation.aggregate([
      {
        $match: {
          reservationDate: { $gte: startDate, $lte: endDate },
          ...branchFilter
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get reservation count by day
    const reservationsByDay = await Reservation.aggregate([
      {
        $match: {
          reservationDate: { $gte: startDate, $lte: endDate },
          ...branchFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$reservationDate' },
            month: { $month: '$reservationDate' },
            day: { $dayOfMonth: '$reservationDate' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1
        }
      }
    ]);
    
    // Calculate totals
    const totalReservations = reservationsByStatus.reduce((sum, status) => sum + status.count, 0);
    
    res.status(200).json({
      success: true,
      data: {
        totalReservations,
        byStatus: reservationsByStatus,
        byDay: reservationsByDay
      }
    });
  } catch (error) {
    next(error);
  }
}; 
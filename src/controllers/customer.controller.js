const Order = require('../models/order.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// @desc    Get customers based on orders (branch-based)
// @route   GET /api/customers
// @access  Private (Admin/Manager/Staff only)
const getCustomers = async (req, res) => {
  try {
    // Get user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Only admin users can access customer data
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access customer data'
      });
    }
    
    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    
    // Get query parameters for filtering and pagination
    const {
      page = 1,
      limit = 20,
      userId,
      firstname,
      lastname,
      email,
      mobile,
      postcode,
      sortBy = 'lastOrderDate',
      sortOrder = 'desc'
    } = req.query;
    
    // Build aggregation pipeline to get unique customers from orders
    const pipeline = [
      // Match orders from the specific branch
      {
        $match: {
          branchId: new mongoose.Types.ObjectId(branchId),
          user: { $exists: true, $ne: null } // Only orders with user (registered customers)
        }
      },
      
      // Group by user to get unique customers with order statistics
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$createdAt' },
          firstOrderDate: { $min: '$createdAt' },
          averageOrderValue: { $avg: '$totalAmount' },
          // Get delivery address from most recent order
          lastDeliveryAddress: { $last: '$deliveryAddress' }
        }
      },
      
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      
      // Unwind user details
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      
      // Project final structure
      {
        $project: {
          id: '$_id',
          firstname: { 
            $ifNull: [
              { $arrayElemAt: [{ $split: ['$userDetails.name', ' '] }, 0] },
              'Guest'
            ]
          },
          lastname: { 
            $ifNull: [
              { 
                $reduce: {
                  input: { $slice: [{ $split: ['$userDetails.name', ' '] }, 1, 10] },
                  initialValue: '',
                  in: { $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ' '] }, '$$this'] }
                }
              },
              ''
            ]
          },
          email: { $ifNull: ['$userDetails.email', ''] },
          mobile: { $ifNull: ['$userDetails.phone', ''] },
          address: {
            $cond: {
              if: { $and: ['$lastDeliveryAddress', '$lastDeliveryAddress.street'] },
              then: {
                $concat: [
                  { $ifNull: ['$lastDeliveryAddress.street', ''] },
                  { $cond: [{ $ne: ['$lastDeliveryAddress.city', ''] }, { $concat: [', ', '$lastDeliveryAddress.city'] }, ''] },
                  { $cond: [{ $ne: ['$lastDeliveryAddress.state', ''] }, { $concat: [', ', '$lastDeliveryAddress.state'] }, ''] }
                ]
              },
              else: { $ifNull: ['$userDetails.address', ''] }
            }
          },
          postcode: {
            $ifNull: [
              '$lastDeliveryAddress.postalCode',
              { $ifNull: ['$userDetails.postcode', ''] }
            ]
          },
          totalOrders: 1,
          totalSpent: { $round: ['$totalSpent', 2] },
          averageOrderValue: { $round: ['$averageOrderValue', 2] },
          lastOrderDate: 1,
          firstOrderDate: 1,
          customerType: {
            $cond: {
              if: { $gte: ['$totalOrders', 5] },
              then: 'Regular',
              else: 'New'
            }
          }
        }
      }
    ];
    
    // Add filtering conditions
    const matchConditions = {};
    
    if (userId) {
      // Validate if userId is a valid ObjectId before using it
      if (mongoose.Types.ObjectId.isValid(userId)) {
        matchConditions.id = new mongoose.Types.ObjectId(userId);
      } else {
        // If invalid ObjectId, return empty results instead of error
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalCustomers: 0,
            customersPerPage: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false
          },
          branchId: branchId.toString()
        });
      }
    }
    
    if (firstname) {
      matchConditions.firstname = { $regex: firstname, $options: 'i' };
    }
    
    if (lastname) {
      matchConditions.lastname = { $regex: lastname, $options: 'i' };
    }
    
    if (email) {
      matchConditions.email = { $regex: email, $options: 'i' };
    }
    
    if (mobile) {
      matchConditions.mobile = { $regex: mobile, $options: 'i' };
    }
    
    if (postcode) {
      matchConditions.postcode = { $regex: postcode, $options: 'i' };
    }
    
    // Add match stage for filtering if there are conditions
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }
    
    // Add sorting
    const sortStage = {};
    switch (sortBy) {
      case 'name':
        sortStage.firstname = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'email':
        sortStage.email = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'totalOrders':
        sortStage.totalOrders = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'totalSpent':
        sortStage.totalSpent = sortOrder === 'desc' ? -1 : 1;
        break;
      case 'lastOrderDate':
      default:
        sortStage.lastOrderDate = sortOrder === 'desc' ? -1 : 1;
        break;
    }
    
    pipeline.push({ $sort: sortStage });
    
    // Get total count for pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Order.aggregate(countPipeline);
    const totalCustomers = countResult.length > 0 ? countResult[0].total : 0;
    
    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });
    
    // Execute aggregation
    const customers = await Order.aggregate(pipeline);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCustomers / parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: customers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCustomers,
        customersPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getCustomers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get customer details by ID
// @route   GET /api/customers/:id
// @access  Private (Admin/Manager/Staff only)
const getCustomer = async (req, res) => {
  try {
    // Get user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Only admin users can access customer data
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access customer data'
      });
    }
    
    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    const customerId = req.params.id;
    
    // Validate customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }
    
    // Get customer details with order history
    const pipeline = [
      // Match orders from the specific branch and customer
      {
        $match: {
          branchId: new mongoose.Types.ObjectId(branchId),
          user: new mongoose.Types.ObjectId(customerId)
        }
      },
      
      // Sort orders by date (newest first)
      { $sort: { createdAt: -1 } },
      
      // Group to get customer summary and order list
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' },
          lastOrderDate: { $max: '$createdAt' },
          firstOrderDate: { $min: '$createdAt' },
          orders: {
            $push: {
              orderId: '$_id',
              orderNumber: '$orderNumber',
              totalAmount: '$totalAmount',
              status: '$status',
              paymentMethod: '$paymentMethod',
              deliveryMethod: '$deliveryMethod',
              createdAt: '$createdAt',
              deliveryAddress: '$deliveryAddress'
            }
          }
        }
      },
      
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      
      // Unwind user details
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      
      // Project final structure
      {
        $project: {
          id: '$_id',
          firstname: { 
            $ifNull: [
              { $arrayElemAt: [{ $split: ['$userDetails.name', ' '] }, 0] },
              'Guest'
            ]
          },
          lastname: { 
            $ifNull: [
              { 
                $reduce: {
                  input: { $slice: [{ $split: ['$userDetails.name', ' '] }, 1, 10] },
                  initialValue: '',
                  in: { $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ' '] }, '$$this'] }
                }
              },
              ''
            ]
          },
          email: { $ifNull: ['$userDetails.email', ''] },
          mobile: { $ifNull: ['$userDetails.phone', ''] },
          address: { $ifNull: ['$userDetails.address', ''] },
          totalOrders: 1,
          totalSpent: { $round: ['$totalSpent', 2] },
          averageOrderValue: { $round: ['$averageOrderValue', 2] },
          lastOrderDate: 1,
          firstOrderDate: 1,
          customerType: {
            $cond: {
              if: { $gte: ['$totalOrders', 5] },
              then: 'Regular',
              else: 'New'
            }
          },
          orders: { $slice: ['$orders', 10] } // Limit to last 10 orders
        }
      }
    ];
    
    const result = await Order.aggregate(pipeline);
    
    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or has no orders in this branch'
      });
    }
    
    const customer = result[0];
    
    res.status(200).json({
      success: true,
      data: customer,
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getCustomer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get customer statistics for dashboard
// @route   GET /api/customers/stats
// @access  Private (Admin/Manager/Staff only)
const getCustomerStats = async (req, res) => {
  try {
    // Get user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Only admin users can access customer data
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access customer data'
      });
    }
    
    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    
    // Get customer statistics
    const stats = await Order.aggregate([
      // Match orders from the specific branch
      {
        $match: {
          branchId: new mongoose.Types.ObjectId(branchId),
          user: { $exists: true, $ne: null }
        }
      },
      
      // Group by user to get unique customers
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$createdAt' }
        }
      },
      
      // Calculate overall statistics
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalRevenue: { $sum: '$totalSpent' },
          averageCustomerValue: { $avg: '$totalSpent' },
          averageOrdersPerCustomer: { $avg: '$totalOrders' },
          newCustomers: {
            $sum: {
              $cond: [
                { $gte: ['$lastOrderDate', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          },
          regularCustomers: {
            $sum: {
              $cond: [{ $gte: ['$totalOrders', 5] }, 1, 0]
            }
          }
        }
      },
      
      // Project final structure
      {
        $project: {
          _id: 0,
          totalCustomers: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          averageCustomerValue: { $round: ['$averageCustomerValue', 2] },
          averageOrdersPerCustomer: { $round: ['$averageOrdersPerCustomer', 1] },
          newCustomers: 1,
          regularCustomers: 1,
          retentionRate: {
            $round: [
              { $multiply: [{ $divide: ['$regularCustomers', '$totalCustomers'] }, 100] },
              1
            ]
          }
        }
      }
    ]);
    
    const customerStats = stats.length > 0 ? stats[0] : {
      totalCustomers: 0,
      totalRevenue: 0,
      averageCustomerValue: 0,
      averageOrdersPerCustomer: 0,
      newCustomers: 0,
      regularCustomers: 0,
      retentionRate: 0
    };
    
    res.status(200).json({
      success: true,
      data: customerStats,
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getCustomerStats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  getCustomerStats
}; 
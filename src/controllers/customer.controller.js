const Order = require('../models/order.model');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const mongoose = require('mongoose');
const { MANAGEMENT_ROLES } = require('../constants/roles');

// @desc    Get customers based on orders (branch-based)
// @route   GET /api/customers
// @access  Private (Admin/Manager/Staff only)
const getCustomers = async (req, res) => {
  try {
    // Get user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
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
      firstName,
      lastName,
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
          firstName: { 
            $ifNull: [
              { $arrayElemAt: [{ $split: ['$userDetails.firstName', ' '] }, 0] },
              'Guest'
            ]
          },
          lastName: { 
            $ifNull: [
              { 
                $reduce: {
                  input: { $slice: [{ $split: ['$userDetails.lastName', ' '] }, 1, 10] },
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
    
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query._id = new mongoose.Types.ObjectId(userId);
    }
    
    if (firstName) {
      matchConditions.firstName = { $regex: firstName, $options: 'i' };
    }
    
    if (lastName) {
      matchConditions.lastName = { $regex: lastName, $options: 'i' };
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
      case 'firstName':
        sortStage.firstName = sortOrder === 'desc' ? -1 : 1;
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
    const countResult = await User.aggregate(countPipeline);
    const totalCustomers = countResult.length > 0 ? countResult[0].total : 0;
    
    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });
    
    // Execute aggregation
    const customers = await User.aggregate(pipeline);
    
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
      }
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
// @access  Public
const getCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    console.log('Fetching customer details for ID:', customerId);
    
    // Validate customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      console.log('Invalid customer ID format:', customerId);
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
    }
    
    // Use aggregation pipeline to get customer with order statistics
    const customerPipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(customerId)
        }
      },
      
      // Lookup orders for this customer
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'orders'
        }
      },
      
      // Project customer details with order statistics
      {
        $project: {
          id: '$_id',
          firstName: { $ifNull: ['$firstName', 'Guest'] },
          lastName: { $ifNull: ['$lastName', 'User'] },
          email: { $ifNull: ['$email', ''] },
          mobile: { $ifNull: ['$phone', ''] },
          address: { $ifNull: ['$address', ''] },
          postcode: { $ifNull: ['$postcode', ''] },
          createdAt: 1,
          updatedAt: 1,
          totalOrders: { $size: '$orders' },
          totalSpent: { 
            $round: [
              { $sum: '$orders.totalAmount' }, 
              2
            ] 
          },
          averageOrderValue: {
            $cond: {
              if: { $gt: [{ $size: '$orders' }, 0] },
              then: {
                $round: [
                  { $avg: '$orders.totalAmount' },
                  2
                ]
              },
              else: 0
            }
          },
          lastOrderDate: { $max: '$orders.createdAt' },
          firstOrderDate: { $min: '$orders.createdAt' },
          customerType: {
            $cond: {
              if: { $gte: [{ $size: '$orders' }, 5] },
              then: 'Regular',
              else: 'New'
            }
          },
          orders: {
            $map: {
              input: '$orders',
              as: 'order',
              in: {
                id: '$$order._id',
                orderNumber: '$$order.orderNumber',
                totalAmount: '$$order.totalAmount',
                status: '$$order.status',
                orderType: '$$order.orderType',
                createdAt: '$$order.createdAt',
                branchId: '$$order.branchId'
              }
            }
          }
        }
      }
    ];
    
    console.log('Executing aggregation pipeline for customer:', customerId);
    const customerResult = await User.aggregate(customerPipeline);
    
    if (!customerResult || customerResult.length === 0) {
      console.log('Customer not found with ID:', customerId);
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    const customerDetails = customerResult[0];
    console.log('Returning customer details with order stats:', {
      id: customerDetails.id,
      totalOrders: customerDetails.totalOrders,
      totalSpent: customerDetails.totalSpent
    });
    
    res.status(200).json({
      success: true,
      data: customerDetails
    });
    
  } catch (error) {
    console.error('Error in getCustomer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message,
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
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
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
    
    // Get customers count and total revenue for the branch
    const customerStats = await User.aggregate([
      {
        $match: {
          role: 'user' // Only regular users
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    { $eq: ['$branchId', new mongoose.Types.ObjectId(branchId)] }
                  ]
                }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $sum: '$orders.totalAmount' } },
          totalOrders: { $sum: { $size: '$orders' } },
          uniqueCustomers: { $addToSet: '$_id' },
          customersWithOrders: {
            $sum: {
              $cond: [{ $gt: [{ $size: '$orders' }, 0] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalOrders: 1,
          totalCustomers: { $size: '$uniqueCustomers' },
          customersWithOrders: 1,
          averageOrdersPerCustomer: {
            $cond: [
              { $gt: ['$customersWithOrders', 0] },
              { $round: [{ $divide: ['$totalOrders', '$customersWithOrders'] }, 2] },
              0
            ]
          },
          averageCustomerValue: {
            $cond: [
              { $gt: ['$customersWithOrders', 0] },
              { $round: [{ $divide: ['$totalRevenue', '$customersWithOrders'] }, 2] },
              0
            ]
          }
        }
      }
    ]);
    
    // Get new vs regular customers
    const customerTypeStats = await User.aggregate([
      {
        $match: {
          role: 'user' // Only regular users
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    { $eq: ['$branchId', new mongoose.Types.ObjectId(branchId)] }
                  ]
                }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $group: {
          _id: '$_id',
          orderCount: { $size: '$orders' }
        }
      },
      {
        $group: {
          _id: null,
          newCustomers: {
            $sum: { $cond: [{ $and: [{ $gt: ['$orderCount', 0] }, { $lt: ['$orderCount', 5] }] }, 1, 0] }
          },
          regularCustomers: {
            $sum: { $cond: [{ $gte: ['$orderCount', 5] }, 1, 0] }
          },
          customersWithoutOrders: {
            $sum: { $cond: [{ $eq: ['$orderCount', 0] }, 1, 0] }
          },
          totalCustomers: { $sum: 1 }
        }
      },
      {
        $project: {
          newCustomers: 1,
          regularCustomers: 1,
          customersWithoutOrders: 1,
          totalCustomers: 1,
          retentionRate: {
            $cond: [
              { $gt: [{ $subtract: ['$totalCustomers', '$customersWithoutOrders'] }, 0] },
              { $round: [
                { $multiply: [
                  { $divide: ['$regularCustomers', { $subtract: ['$totalCustomers', '$customersWithoutOrders'] }] }, 
                  100
                ] },
                2
              ] },
              0
            ]
          }
        }
      }
    ]);
    
    const stats = customerStats[0] || {
      totalCustomers: 0,
      totalRevenue: 0,
      averageCustomerValue: 0,
      averageOrdersPerCustomer: 0
    };
    
    const typeStats = customerTypeStats[0] || {
      newCustomers: 0,
      regularCustomers: 0,
      retentionRate: 0
    };
    
    res.status(200).json({
      success: true,
      data: {
        ...stats,
        ...typeStats
      },
      branchId: branchId.toString()
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customer statistics'
    });
  }
};

// @desc    Update customer information
// @route   PUT /api/customers/:id
// @access  Private (Admin/Manager/Staff only)
const updateCustomer = async (req, res) => {
  try {
    // Get user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    // Only admin users can access customer data
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update customer data'
      });
    }
    
    const customerId = req.params.id;
    const { 
      firstName, 
      lastName, 
      name, 
      email, 
      mobileNumber, 
      phone,
      addressLine1, 
      addressLine2, 
      city, 
      postalCode,
      address,
      emailNotifications,
      smsNotifications 
    } = req.body;
    
    // Validate customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }
    
    // Find the customer
    const customer = await User.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber;
    if (phone !== undefined) updateData.phone = phone;
    if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2;
    if (city !== undefined) updateData.city = city;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    if (address !== undefined) updateData.address = address;
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
    if (smsNotifications !== undefined) updateData.smsNotifications = smsNotifications;
    
    // Update the customer
    const updatedCustomer = await User.findByIdAndUpdate(
      customerId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    // Handle duplicate email error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already registered'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating customer'
    });
  }
};

// @desc    Get simple customers list (POST method)
// @route   POST /api/customers/list
// @access  Public - no auth needed
const getCustomersList = async (req, res) => {
  try {
    // Get filters from request body
    const {
      page = 1,
      limit = 20,
      userId,
      firstName,
      lastName,
      email,
      mobile,
      postcode,
      sortBy = 'lastOrderDate',
      sortOrder = 'desc',
      branchId
    } = req.body;
    
    // If branchId is provided, find customers who have orders in that branch
    let customerIds = [];
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      // Get all unique user IDs who have orders in this branch
      const orders = await Order.find({ 
        branchId: new mongoose.Types.ObjectId(branchId),
        user: { $exists: true, $ne: null }
      }).distinct('user');
      
      customerIds = orders;
    }
    
    // Build aggregation pipeline to get customers with their order statistics
    const pipeline = [
      // Match users who have orders in the specified branch (if branchId provided)
      ...(customerIds.length > 0 ? [{
        $match: {
          _id: { $in: customerIds }
        }
      }] : []),
      
      // Lookup orders for each user
      {
        $lookup: {
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    ...(branchId && mongoose.Types.ObjectId.isValid(branchId) ? 
                      [{ $eq: ['$branchId', new mongoose.Types.ObjectId(branchId)] }] : [])
                  ]
                }
              }
            }
          ],
          as: 'orders'
        }
      },
      
      // Only include users who have at least one order
      {
        $match: {
          'orders.0': { $exists: true }
        }
      },
      
      // Project user data with order statistics
      {
        $project: {
          id: '$_id',
          firstName: { $ifNull: ['$firstName', 'Guest'] },
          lastName: { $ifNull: ['$lastName', 'User'] },
          email: { $ifNull: ['$email', ''] },
          mobile: { $ifNull: ['$phone', ''] },
          address: { $ifNull: ['$address', ''] },
          postcode: { $ifNull: ['$postcode', ''] },
          totalOrders: { $size: '$orders' },
          totalSpent: { 
            $round: [
              { $sum: '$orders.totalAmount' }, 
              2
            ] 
          },
          averageOrderValue: {
            $round: [
              { $avg: '$orders.totalAmount' },
              2
            ]
          },
          lastOrderDate: { $max: '$orders.createdAt' },
          firstOrderDate: { $min: '$orders.createdAt' },
          customerType: {
            $cond: {
              if: { $gte: [{ $size: '$orders' }, 5] },
              then: 'Regular',
              else: 'New'
            }
          },
          createdAt: 1
        }
      }
    ];
    
    // Add filtering conditions
    const matchConditions = {};
    
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      matchConditions.id = new mongoose.Types.ObjectId(userId);
    }
    
    if (firstName) {
      matchConditions.firstName = { $regex: firstName, $options: 'i' };
    }
    
    if (lastName) {
      matchConditions.lastName = { $regex: lastName, $options: 'i' };
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
      case 'firstName':
        sortStage.firstName = sortOrder === 'desc' ? -1 : 1;
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
    const countResult = await User.aggregate(countPipeline);
    const totalCustomers = countResult.length > 0 ? countResult[0].total : 0;
    
    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });
    
    // Execute aggregation
    const customers = await User.aggregate(pipeline);
    
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
      }
    });
    
  } catch (error) {
    console.error('Error in getCustomersList:', error);
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
  getCustomerStats,
  updateCustomer,
  getCustomersList
}; 
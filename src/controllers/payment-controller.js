const Order = require("../models/order.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");

// Get payments with filters
exports.getPayments = async (req, res) => {
  try {
    const {
      status = "paid",
      search = "",
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    // Build match conditions
    const matchConditions = {
      paymentStatus: status,
      paymentMethod: { $in: ["card"] }, // Only card payments have Stripe data
      stripePaymentIntentId: { $exists: true, $ne: null },
    };

    // Date filter
    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) {
        matchConditions.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchConditions.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter
    let searchConditions = [];
    if (search) {
      searchConditions = [
        { stripePaymentIntentId: { $regex: search, $options: "i" } },
        { orderNumber: { $regex: search, $options: "i" } },
      ];
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $addFields: {
          userFullName: {
            $concat: ["$userDetails.firstName", " ", "$userDetails.lastName"],
          },
        },
      },
    ];

    // Add search conditions if search term exists
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            ...searchConditions,
            { userFullName: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add sorting
    pipeline.push({ $sort: { createdAt: -1 } });

    // Get total count
    const totalPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await Order.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

    // Project required fields
    pipeline.push({
      $project: {
        _id: 1,
        stripePaymentIntentId: 1,
        paymentStatus: 1,
        userFullName: 1,
        totalAmount: 1,
        orderNumber: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const payments = await Order.aggregate(pipeline);

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

// Get payment statistics
exports.getPaymentStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $match: {
          paymentMethod: { $in: ["card"] },
          stripePaymentIntentId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
            },
          },
          totalRefunded: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "refunded"] },
                "$totalAmount",
                0,
              ],
            },
          },
          totalTax: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "paid"] },
                { $multiply: ["$totalAmount", 0.1] }, // Assuming 10% tax
                0,
              ],
            },
          },
          totalTransactions: { $sum: 1 },
          paidTransactions: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
            },
          },
          refundedTransactions: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "refunded"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const result =
      stats.length > 0
        ? stats[0]
        : {
            totalPaid: 0,
            totalRefunded: 0,
            totalTax: 0,
            totalTransactions: 0,
            paidTransactions: 0,
            refundedTransactions: 0,
          };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching payment stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment statistics",
      error: error.message,
    });
  }
};

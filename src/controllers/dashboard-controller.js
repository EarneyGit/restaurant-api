const Order = require('../models/order.model');
const User = require('../models/user.model');

const getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide startDate and endDate"
      });
    }

    // Create date objects from the input strings
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set end date to the end of the day
    end.setHours(23, 59, 59, 999);

    // Query conditions for the date range
    const dateFilter = {
      createdAt: {
        $gte: start,
        $lte: end
      }
    };

    // Get total orders count
    const totalOrders = await Order.countDocuments(dateFilter);

    // Get total revenue (sum of finalTotal field)
    const revenueResult = await Order.aggregate([
      { $match: dateFilter },
      { $group: {
          _id: null,
          totalRevenue: { $sum: "$finalTotal" }
        }
      }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Get total discount amount
    const discountResult = await Order.aggregate([
      { $match: dateFilter },
      { $group: {
          _id: null,
          totalDiscount: { $sum: { $ifNull: ["$discount.discountAmount", 0] } }
        }
      }
    ]);
    const totalDiscount = discountResult.length > 0 ? discountResult[0].totalDiscount : 0;

    // Get distinct customers who placed orders in the date range
    const distinctCustomers = await Order.distinct('user', dateFilter);
    const totalCustomers = distinctCustomers.filter(id => id !== null).length;

    return res.status(200).json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        totalDiscount,
        totalCustomers
      },
      message: "Stats fetched successfully"
    });
  } catch (error) {
    console.error("Error in fetching stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getStats
}

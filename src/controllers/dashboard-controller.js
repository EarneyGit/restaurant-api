const Order = require('../models/order.model');
const { roundOff } = require('../utils/common-utils');

const getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide startDate and endDate"
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: {
        $gte: start,
        $lte: end
      }
    };

    const orders = await Order.find(dateFilter).lean();

    let completedOrders = 0;
    let cancelledOrders = 0;
    let revenueAmount = 0;
    let refundedAmount = 0;
    let totalDiscount = 0;

    // Track customers with at least one completed order
    const customerSet = new Set();
    // Track all customers to check if they have at least one completed order
    const customerOrdersMap = new Map();

    for (const order of orders) {
      const isCashOrCOD = ['cash', 'cash_on_delivery'].includes(order.paymentMethod);
      const isOtherPayment = !isCashOrCOD; // Any other payment method

      // For cash or COD, only check order status
      // For other payment methods, check payment status
      const isCompleted =
        (isCashOrCOD && order.status !== 'cancelled') ||
        (isOtherPayment && order.paymentStatus === 'paid');

      const isCancelledOrRefunded =
        (isCashOrCOD && order.status === 'cancelled') ||
        (isOtherPayment && order.paymentStatus === 'refunded');

      // Track orders by customer
      if (order.user) {
        const userId = order.user.toString();
        if (!customerOrdersMap.has(userId)) {
          customerOrdersMap.set(userId, { completed: 0, cancelled: 0 });
        }
        
        if (isCompleted) {
          customerOrdersMap.get(userId).completed += 1;
        } else if (isCancelledOrRefunded) {
          customerOrdersMap.get(userId).cancelled += 1;
        }
      }

      if (isCompleted) {
        completedOrders++;
        revenueAmount += order.finalTotal || 0;
        totalDiscount += order.discount?.discountAmount || 0;
      } else if (isCancelledOrRefunded) {
        cancelledOrders++;
        refundedAmount += order.finalTotal || 0;
      }
    }
    
    // Only count customers who have at least one completed order
    for (const [userId, orderCounts] of customerOrdersMap.entries()) {
      if (orderCounts.completed > 0) {
        customerSet.add(userId);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        completedOrders,
        cancelledOrders,
        revenueAmount: roundOff(revenueAmount),
        refundedAmount: roundOff(refundedAmount),
        totalDiscount: roundOff(totalDiscount),
        totalCustomers: customerSet.size
      },
      message: "Stats fetched successfully"
    });

  } catch (error) {
    console.error("Error in fetching stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  getStats
};

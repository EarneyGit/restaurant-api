/**
 * This job is used to check the payment status of the orders
 * It is used to check the payment status of the orders every 10 minutes
 * If the payment is failed, it will update the order status to failed
 * If the payment is successful, it will update the order status to completed
 * If the payment is pending, it will update the order status to pending
 * If the payment is processing, it will update the order status to processing
 * If the payment is authorized, it will update the order status to authorized
 * If the payment is captured, it will update the order status to captured
 * If the payment is refunded, it will update the order status to refunded
 * If the payment is voided, it will update the order status to voided
 */
const cron = require("node-cron");
const Order = require("../models/order.model");
const {
  getPaymentIntentStatus,
} = require("../utils/stripe-config/stripe-config");
// every 1 minutes
async function checkPaymentStatusJob(cronExpression) {
  cron.schedule(cronExpression, async () => {
    try {
      console.log("Checking payment status...", new Date()); // log the time
      const fromDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const orders = await Order.find({
        paymentStatus: "pending",
        paymentMethod: "card",
        createdAt: { $gte: fromDate },
      }).lean();
      console.log(`Found ${orders.length} orders to check`);
      for (const order of orders) {
        try {
          console.log(
            `\n\n\nChecking payment status for order ${
              order._id
            }, payment intent id: ${
              order.stripePaymentIntentId
            }, payment status: ${order.paymentStatus}, status: ${
              order.status
            }, createdAt: ${order.createdAt}, user: ${JSON.stringify(
              order?.orderCustomerDetails || {}
            )}\n\n`
          );
          const paymentStatus = await getPaymentIntentStatus(
            order.stripePaymentIntentId
          );

          console.log(`Payment status: ${paymentStatus.message}`);

          if (
            paymentStatus.success &&
            paymentStatus.message === "Payment successful"
          ) {
            // Payment succeeded - update order status
            order.paymentStatus = "paid";
            order.stripePaymentDate = new Date();

            // If order was in pending payment status, move to processing
            if (order.status === "pending") {
              order.status = "processing";
              orderStatus = "processing";
            }
          } else if (paymentStatus.message === "Payment is still processing") {
            // Payment still processing
            order.paymentStatus = "processing";
          } else if (
            paymentStatus.message.includes("failed") ||
            paymentStatus.message.includes("canceled")
          ) {
            // Payment failed
            order.paymentStatus = "failed";

            // If order was in pending status, mark as cancelled
            if (order.status === "pending") {
              order.status = "cancelled";
            }
          } else if (paymentStatus.message.includes("refunded")) {
            order.paymentStatus = "refunded";
          }
          await Order.updateOne(
            { _id: order._id },
            {
              $set: {
                paymentStatus: order.paymentStatus,
                status: order.status,
                stripePaymentDate: order.stripePaymentDate,
              },
            }
          );
          console.log(
            `Updated order ${order._id} with payment status ${order.paymentStatus} and status ${order.status}`
          );
        } catch (error) {
          console.error(
            `Error checking payment status for order ${order._id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    }
  });
}
module.exports = checkPaymentStatusJob;

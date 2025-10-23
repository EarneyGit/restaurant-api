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

const cronJob = require("cron").CronJob;

const Order = require("../models/order.model");
const {
  sendMailForOrderCreated,
  sendMailForCancelOrder,
  sendMailForRefundOrder,
} = require("../utils/emailSender");
const { getOrderCustomerDetails } = require("../utils/functions");
const {
  getPaymentIntentStatus,
  refundPayment,
} = require("../utils/stripe-config/stripe-config");

const intiateRefund = async (order) => {
  try {
    const refund = await refundPayment(order.stripePaymentIntentId);
    return refund;
  } catch (error) {
    console.error("Error initiating refund:", error);
    return null;
  }
};

// every 1 minutes
async function checkPaymentStatusJob(cronExpression) {
  const checkStatus = async () => {
    try {
      console.log(
        "\nCHECK_PAYMENT_STATUS_CRON::::Checking payment status...",
        new Date()
      ); // log the time
      const fromDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const orders = await Order.find({
        $or: [
          {
            paymentMethod: "card",
            paymentStatus: { $in: ["pending", "processing"] },
          },
          { paymentMethod: "card", status: "cancelled", paymentStatus: "paid" },
        ],
        createdAt: { $gte: fromDate },
      }).lean();
      console.log(
        `\nCHECK_PAYMENT_STATUS_CRON::::Found ${orders.length} orders to check`
      );
      for (const order of orders) {
        try {
          console.log(
            `\nCHECK_PAYMENT_STATUS_CRON::::
            \n\n\nChecking payment status for order ${
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

          console.log(
            `\nCHECK_PAYMENT_STATUS_CRON::::Payment status: ${paymentStatus.message}`
          );

          if (
            paymentStatus.success &&
            paymentStatus.message === "Payment successful"
          ) {
            // Payment succeeded - update order status
            order.paymentStatus = "paid";
            order.stripePaymentDate = new Date();
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
            order.status = "cancelled";
          } else if (paymentStatus.message.includes("refunded")) {
            order.paymentStatus = "refunded";
            order.status = "cancelled";
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
          const customerDetails = getOrderCustomerDetails(order);
          order.customerName =
            customerDetails.firstName + " " + customerDetails.lastName;
          order.customerEmail = customerDetails.email;
          order.customerPhone = customerDetails.phone;
          order.customerAddress = customerDetails.address;

          if (order.status === "cancelled" && order.paymentStatus === "paid") {
            const refund = await intiateRefund(order);
            if (refund) {
              order.paymentStatus = "refunded";
            }
          }

          if (order.paymentStatus === "paid" && order.status !== "cancelled") {
            // if payment status is paid, then send order paid email
            sendMailForOrderCreated(
              order.customerEmail,
              order.branchId._id,
              order
            ).catch((error) => {
              console.error(
                "\nCHECK_PAYMENT_STATUS_CRON::::Error sending order created email:",
                error
              );
            });
          } else if (order.paymentStatus === "failed" && order.status !== "cancelled") {
            // if payment status is failed, then send order cancelled email
            sendMailForCancelOrder(
              order.customerEmail,
              order,
              "Payment failed"
            ).catch((error) => {
              console.error(
                "\nCHECK_PAYMENT_STATUS_CRON::::Error sending order cancelled email:",
                error
              );
            });
          } else if (order.paymentStatus === "refunded") {
            // if payment status is refunded, then send order refunded email
            sendMailForRefundOrder(order.customerEmail, order).catch(
              (error) => {
                console.error(
                  "\nCHECK_PAYMENT_STATUS_CRON::::Error sending order refunded email:" +
                    error
                );
              }
            );
          }
          console.log(
            `\nCHECK_PAYMENT_STATUS_CRON::::Updated order ${order._id} with payment status ${order.paymentStatus} and status ${order.status}`
          );
        } catch (error) {
          console.error(
            `\nCHECK_PAYMENT_STATUS_CRON::::Error checking payment status for order ${order._id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "\nCHECK_PAYMENT_STATUS_CRON::::Error checking payment status:",
        error
      );
    }
  };

  const job = new cronJob(
    cronExpression,
    async () => {
      console.log(
        "\nCHECK_PAYMENT_STATUS_CRON::::checkPaymentStatusJobCron job running at",
        new Date()
      );
      // your async or sync task
      try {
        await checkStatus();
      } catch (error) {
        console.error(
          "\nCHECK_PAYMENT_STATUS_CRON::::Error checking payment status:",
          error
        );
      }
    },
    null,
    true // start job immediately
  );
  job.start();
}
module.exports = checkPaymentStatusJob;

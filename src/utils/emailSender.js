const nodemailer = require("nodemailer");
const { toFixed } = require("./functions");

/**
 * Create a nodemailer transporter
 * @returns {Object} nodemailer transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "siva638302@gmail.com",
      pass: process.env.EMAIL_PASS || "kcvj pubw xxkl dght",
    },
  });
};

/**
 * Generate a random numeric OTP
 * @param {number} length - Length of OTP
 * @returns {string} Generated OTP
 */
const generateOTP = (length = 6) => {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @returns {Promise<boolean>} Success status
 */
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || "Restaurant API <siva638302@gmail.com>",
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      cc: options.cc || undefined,
      bcc: process.env.EMAIL_BCC || undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};

/**
 * Send verification OTP email
 * @param {string} email - User's email
 * @param {string} otp - OTP code
 * @param {string} name - User's name
 * @returns {Promise<boolean>} Success status
 */
const sendVerificationOTP = async (email, otp, name) => {
  const subject = "Email Verification - Restaurant API";
  const text = `Dear ${name},\n\nYour email verification OTP is: ${otp}\n\nThis code will expire in 10 minutes.\n\nRegards,\nRestaurant API Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Email Verification</h2>
      <p>Dear ${name},</p>
      <p>Your email verification OTP is:</p>
      <div style="background-color: #f4f4f4; padding: 12px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>Regards,<br>Restaurant API Team</p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send password reset OTP email
 * @param {string} email - User's email
 * @param {string} otp - OTP code
 * @param {string} name - User's name (optional)
 * @returns {Promise<boolean>} Success status
 */
const sendPasswordResetOTP = async (email, otp, name = "User") => {
  const subject = "Password Reset - Restaurant API";
  const text = `Dear ${name},\n\nYou requested a password reset.\n\nYour password reset OTP is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nRegards,\nRestaurant API Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset</h2>
      <p>Dear ${name},</p>
      <p>You requested a password reset.</p>
      <p>Your password reset OTP is:</p>
      <div style="background-color: #f4f4f4; padding: 12px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <p>Regards,<br>Restaurant API Team</p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send order created email
 * @param {string} email - Customer's email
 * @param {string} branchId - Branch ID
 * @param {Object} order - Order details
 * @returns {Promise<boolean>} Success status
 */
const sendMailForOrderCreated = async (email, branchId, order) => {
  const statusURL = `${process.env.FRONTEND_URL}/order-status/${order._id}?branchId=${branchId}`;
  const subject = `Order Confirmation - #${order.orderNumber}`;

  // Get customer name
  const customerName = order.customerName || "Customer";

  // Format currency
  const formatCurrency = (amount) => `£${toFixed(amount, 2)}`;

  // Generate items HTML
  const generateItemsHTML = () => {
    if (!order.products || order.products.length === 0) {
      return "<p>No items found in this order.</p>";
    }

    return order.products
      .map((item) => {
        const productName = item.product?.name || "Unknown Product";
        const quantity = item.quantity || 1;
        const price = item.price || 0;
        const itemTotal = price * quantity;

        // Generate attributes HTML
        const attributesHTML =
          item.selectedAttributes && item.selectedAttributes.length > 0
            ? item.selectedAttributes
                .map((attr) => {
                  const selectedItemsHTML =
                    attr.selectedItems && attr.selectedItems.length > 0
                      ? attr.selectedItems
                          .map(
                            (selectedItem) =>
                              `<span style="display: block; margin-left: 20px; color: #666; font-size: 14px;">
                • ${selectedItem.itemName} ${
                                selectedItem.quantity > 1
                                  ? `(x${selectedItem.quantity})`
                                  : ""
                              } 
                ${
                  selectedItem.itemPrice > 0
                    ? `+${formatCurrency(selectedItem.itemPrice)}`
                    : ""
                }
              </span>`
                          )
                          .join("")
                      : "";

                  return `
            <div style="margin-left: 20px; color: #666; font-size: 14px;">
              <strong>${attr.attributeName}:</strong>
              ${selectedItemsHTML}
            </div>
          `;
                })
                .join("")
            : "";

        return `
        <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <h4 style="margin: 0 0 5px 0; color: #333; font-size: 16px;">${productName}</h4>
              ${
                item.notes
                  ? `<p style="margin: 5px 0; color: #666; font-style: italic;">Note: ${item.notes}</p>`
                  : ""
              }
              ${attributesHTML}
            </div>
            <div style="text-align: right; min-width: 100px;">
              <div style="color: #666; font-size: 14px;">Qty: ${quantity}</div>
              <div style="font-weight: bold; color: #333; font-size: 16px;">${formatCurrency(
                itemTotal
              )}</div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  };

  // Generate totals HTML
  const generateTotalsHTML = () => {
    const subtotal = order.subtotal || 0;
    const tax = order.tax || 0;
    const deliveryFee = order.deliveryFee || 0;
    const tips = order.tips || 0;
    const serviceCharge = order.serviceCharge || 0;
    const discountAmount =
      order.discount?.discountAmount ||
      order.discountApplied?.discountAmount ||
      0;
    const finalTotal =
      order.finalTotal || order.total || order.totalAmount || 0;

    return `
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #333;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Subtotal:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">${formatCurrency(
              subtotal
            )}</td>
          </tr>
          ${
            tax > 0
              ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Tax:</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(
              tax
            )}</td>
          </tr>
          `
              : ""
          }
          ${
            deliveryFee > 0
              ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Delivery Fee:</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(
              deliveryFee
            )}</td>
          </tr>
          `
              : ""
          }
          ${
            serviceCharge > 0
              ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Service Charge:</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(
              serviceCharge
            )}</td>
          </tr>
          `
              : ""
          }
          ${
            tips > 0
              ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Tips:</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(
              tips
            )}</td>
          </tr>
          `
              : ""
          }
          ${
            discountAmount > 0
              ? `
          <tr style="color: #28a745;">
            <td style="padding: 8px 0;">Discount ${
              order.discount?.code || order.discountApplied?.code
                ? `(${order.discount?.code || order.discountApplied?.code})`
                : ""
            }:</td>
            <td style="padding: 8px 0; text-align: right;">-${formatCurrency(
              discountAmount
            )}</td>
          </tr>
          `
              : ""
          }
          <tr style="border-top: 2px solid #333; font-size: 18px; font-weight: bold;">
            <td style="padding: 12px 0 8px 0; color: #333;">Total:</td>
            <td style="padding: 12px 0 8px 0; text-align: right; color: #333;">${formatCurrency(
              finalTotal
            )}</td>
          </tr>
        </table>
      </div>
    `;
  };

  // Generate order details HTML
  const generateOrderDetailsHTML = () => {
    const orderType = order.orderType || order.deliveryMethod || "Collection";
    const paymentMethod = order.paymentMethod || "Cash";
    const estimatedTime = order.estimatedTimeToComplete || 45;

    return `
      <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border: 1px solid #dee2e6; border-radius: 8px;">
        <h3 style="color: #495057; margin-top: 0;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #666;">Order Number:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #333;">#${
              order.orderNumber
            }</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #666;">Order Type:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #333; text-transform: capitalize;">${orderType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #666;">Payment Method:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #333; text-transform: capitalize;">${paymentMethod}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #666;">Estimated Time:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #333;">${estimatedTime} minutes</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold; color: #666;">Time Slot:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #333;">${
              order.selectedTimeSlot || "Not specified"
            }</td>
          </tr>
          ${
            order.deliveryAddress && orderType === "delivery"
              ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #666;">Delivery Address:</td>
            <td style="padding: 8px 0; color: #333;">
              ${order.deliveryAddress.street || ""}<br>
              ${order.deliveryAddress.city || ""} ${
                  order.deliveryAddress.state || ""
                }<br>
              ${
                order.deliveryAddress.postalCode ||
                order.deliveryAddress.zipCode ||
                ""
              } ${order.deliveryAddress.country || ""}
              ${
                order.deliveryAddress.notes
                  ? `<br><em>Note: ${order.deliveryAddress.notes}</em>`
                  : ""
              }
            </td>
          </tr>
          `
              : ""
          }
          ${
            order.customerNotes
              ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #666;">Special Instructions:</td>
            <td style="padding: 8px 0; color: #333;">${order.customerNotes}</td>
          </tr>
          `
              : ""
          }
        </table>
      </div>
    `;
  };

  const text = `Dear ${customerName},

Thank you for your order! Your order #${
    order.orderNumber
  } has been confirmed and is being prepared.

Order Details:
- Order Number: #${order.orderNumber}
- Order Type: ${order.orderType || order.deliveryMethod || "Collection"}
- Payment Method: ${order.paymentMethod || "Cash"}
- Estimated Time: ${order.estimatedTimeToComplete || 45} minutes
- Time Slot: ${order.selectedTimeSlot || "Not specified"}
  <br>
- Total Amount: ${formatCurrency(
    order.finalTotal || order.total || order.totalAmount
  )}
  <br>
You can track your order status at: ${statusURL}
`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Order Confirmation</h1>
        <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your order!</p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 30px 20px;">
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin-bottom: 25px;">
          <h2 style="color: #28a745; margin: 0 0 10px 0; font-size: 20px;">Order Confirmed!</h2>
          <p style="margin: 0; color: #155724;">Dear ${customerName}, your order has been confirmed and is being prepared by our kitchen team.</p>
        </div>
        
        <!-- Order Details -->
        ${generateOrderDetailsHTML()}
        
        <!-- Items -->
        <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border: 1px solid #dee2e6; border-radius: 8px;">
          <h3 style="color: #495057; margin-top: 0;">Order Items</h3>
          ${generateItemsHTML()}
        </div>
        
        <!-- Totals -->
        ${generateTotalsHTML()}
        
        <!-- Track Order Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${statusURL}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
            Track Your Order
          </a>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px;">
          <p style="margin: 0 0 10px 0; color: #6c757d;">
            <strong>Questions about your order?</strong><br>
            Contact us and we'll be happy to help!
          </p>
          <p style="margin: 0; color: #6c757d;">
            Thank you for choosing us!<br>
            <strong>Restaurant Team</strong>
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send order cancellation email
 * @param {string} email - Customer's email
 * @param {Object} order - Order details
 * @param {string} reason - Cancellation reason
 * @returns {Promise<boolean>} Success status
 */
const sendMailForCancelOrder = async (
  email,
  order,
  reason = "Order cancelled by customer"
) => {
  const subject = `Order Cancelled - #${order.orderNumber}`;
  const text = `Dear ${
    order.customerName || "Customer"
  },\n\nWe regret to inform you that your order #${
    order.orderNumber
  } has been cancelled.\n\nOrder Details:\n- Order Number: #${
    order.orderNumber
  }\n- Total Amount: £${order.total}\n- Order Type: ${
    order.orderType || "Collection"
  }\n- Cancellation Reason: ${reason}\n\nIf you have any questions or concerns, please contact us.\n\nRegards,\nRestaurant Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
        <h2 style="color: #dc3545; margin-top: 0;">Order Cancelled</h2>
        <p>Dear ${order.customerName || "Customer"},</p>
        <p>We regret to inform you that your order has been cancelled.</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border: 1px solid #dee2e6; border-radius: 8px;">
        <h3 style="color: #495057; margin-top: 0;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Order Number:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">#${
              order.orderNumber
            }</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Total Amount:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${formatCurrency(
              order.total || 0
            )}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Order Type:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${
              order.orderType || "Collection"
            }</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Cancellation Reason:</td>
            <td style="padding: 8px 0;">${reason}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #6c757d;">
          <strong>Refund Information:</strong><br>
          If payment was made, a full refund will be processed within 3-5 business days.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <p style="color: #6c757d;">If you have any questions or concerns, please contact us.</p>
        <p style="color: #6c757d;">Regards,<br><strong>Restaurant Team</strong></p>
      </div>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send order delay notification email
 * @param {string} email - Customer's email
 * @param {Object} order - Order details
 * @param {number} delayMinutes - Delay in minutes
 * @returns {Promise<boolean>} Success status
 */
const sendMailForAddDelay = async (
  email,
  order,
  delayMinutes,
  newEstimation
) => {
  const subject = `Order Update - #${order.orderNumber}`;
  const text = `Dear ${
    order.customerName || "Customer"
  },\n\nWe apologize for the delay in preparing your order #${
    order.orderNumber
  }.\n\nYour order is now estimated to be ready in approximately ${delayMinutes} minutes more than the previous estimate.\n\nWe appreciate your patience and understanding.\n\nRegards,\nRestaurant Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
        <h2 style="color: #856404; margin-top: 0;">Order Update</h2>
        <p>Dear ${order.customerName || "Customer"},</p>
        <p>We apologize for the delay in preparing your order. Your order is now estimated to be ready in approximately ${delayMinutes} minutes more than the previous estimate.</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border: 1px solid #dee2e6; border-radius: 8px;">
        <h3 style="color: #495057; margin-top: 0;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Order Number:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">#${
              order.orderNumber
            }</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Total Amount:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${formatCurrency(
              order.total
            )}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">New Estimated Time:</td>
            <td style="padding: 8px 0;">${newEstimation} minutes</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #0c5460;">
          <strong>We apologize for any inconvenience caused.</strong><br>
          We are working hard to ensure your order is prepared with the highest quality.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <p style="color: #6c757d;">We appreciate your patience and understanding.</p>
        <p style="color: #6c757d;">Regards,<br><strong>Restaurant Team</strong></p>
      </div>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send order refunded email
 * @param {string} email - Customer's email
 * @param {Object} order - Order details
 * @returns {Promise<boolean>} Success status
 */
const sendMailForRefundOrder = async (email, order) => {
  const subject = `Order Refunded - #${order.orderNumber}`;
  const text = `Dear ${
    order.customerName || "Customer"
  },\n\nWe are pleased to inform you that your order #${
    order.orderNumber
  } has been refunded.\n\nOrder Details:\n- Order Number: #${
    order.orderNumber
  }\n- Total Amount: £${order.total}\n- Order Type: ${
    order.orderType || "Collection"
  }\n\nRegards,\nRestaurant Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
        <h2 style="color: #007bff; margin-top: 0;">Order Refunded</h2>
        <p>Dear ${order.customerName || "Customer"},</p>
        <p>We are pleased to inform you that your order has been refunded.</p>
      </div>

      <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border: 1px solid #dee2e6; border-radius: 8px;">
        <h3 style="color: #495057; margin-top: 0;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Order Number:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">#${
              order.orderNumber
            }</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Total Amount:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${formatCurrency(
              order.total
            )}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        <p style="color: #6c757d;">If you have any questions or concerns, please contact us.</p>
        <p style="color: #6c757d;">Thank you for choosing us!<br>
          <strong>Restaurant Team</strong>
        </p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: email,
    cc: process.env.EMAIL_CC,
    subject,
    text,
    html,
  });
};

module.exports = {
  generateOTP,
  sendEmail,
  sendVerificationOTP,
  sendPasswordResetOTP,
  sendMailForOrderCreated,
  sendMailForCancelOrder,
  sendMailForAddDelay,
  sendMailForRefundOrder,
};

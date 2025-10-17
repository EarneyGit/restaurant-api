const nodemailer = require("nodemailer");

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
    order.user.firstName + " " + order.user.lastName || "Customer"
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
        <p>Dear ${order.user.firstName + " " + order.user.lastName || "Customer"},</p>
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
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">£${
              order.total
            }</td>
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
const sendMailForAddDelay = async (email, order, delayMinutes) => {
  const subject = `Order Update - #${order.orderNumber}`;
  const text = `Dear ${
    order.user.firstName + " " + order.user.lastName || "Customer"
  },\n\nWe apologize for the delay in preparing your order #${
    order.orderNumber
  }.\n\nYour order is now estimated to be ready in approximately ${delayMinutes} minutes earlier than the previous estimate.\n\nWe appreciate your patience and understanding.\n\nRegards,\nRestaurant Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
        <h2 style="color: #856404; margin-top: 0;">Order Update</h2>
        <p>Dear ${order.user.firstName + " " + order.user.lastName || "Customer"},</p>
        <p>We apologize for the delay in preparing your order. Your order is now estimated to be ready in approximately ${delayMinutes} minutes earlier than the previous estimate.</p>
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
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">£${
              order.total
            }</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">New Estimated Time:</td>
            <td style="padding: 8px 0;">${delayMinutes} minutes</td>
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

module.exports = {
  generateOTP,
  sendEmail,
  sendVerificationOTP,
  sendPasswordResetOTP,
  sendMailForCancelOrder,
  sendMailForAddDelay,
};

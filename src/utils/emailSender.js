const nodemailer = require('nodemailer');

/**
 * Create a nodemailer transporter
 * @returns {Object} nodemailer transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Generate a random numeric OTP
 * @param {number} length - Length of OTP
 * @returns {string} Generated OTP
 */
const generateOTP = (length = 6) => {
  let otp = '';
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
      from: process.env.EMAIL_FROM || 'Restaurant API <noreply@restaurant.com>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
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
  const subject = 'Email Verification - Restaurant API';
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
 * @returns {Promise<boolean>} Success status
 */
const sendPasswordResetOTP = async (email, otp) => {
  const subject = 'Password Reset - Restaurant API';
  const text = `You requested a password reset.\n\nYour password reset OTP is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nRegards,\nRestaurant API Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset</h2>
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

module.exports = {
  generateOTP,
  sendEmail,
  sendVerificationOTP,
  sendPasswordResetOTP
}; 
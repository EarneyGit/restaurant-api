const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const compression = require("compression");
const connectDB = require("./config/db");
const { initSocket } = require("./utils/socket");
const { requestLoggerMiddleware } = require("./utils/logMiddelware");

// Load environment variables if dotenv is available
try {
  const result = require("dotenv").config({
    path: path.join(__dirname, "..", ".env"),
  });
  console.log(result);
  console.log("dotenv found, using env values");
} catch (error) {
  console.log("dotenv not found, using default values");
}

// Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const dashboardRouter = require("./routes/dashboard.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const orderRoutes = require("./routes/order.routes");
const reservationRoutes = require("./routes/reservation.routes");
const branchRoutes = require("./routes/branch.routes");
const reportRoutes = require("./routes/report.routes");
const roleRoutes = require("./routes/role.routes");
const cartRoutes = require("./routes/cart.routes");
const orderingTimesRoutes = require("./routes/ordering-times.routes");
const attributeRoutes = require("./routes/attribute.routes");
const productAttributeItemRoutes = require("./routes/product-attribute-item.routes");
const leadTimesRoutes = require("./routes/lead-times.routes");
const pushNotificationRoutes = require("./routes/push-notification.routes");
const repeatingPushNotificationRoutes = require("./routes/repeating-push-notification.routes");
const priceChangesRoutes = require("./routes/price-changes.routes");
const smsEmailMessageRoutes = require("./routes/sms-email-message.routes");
const addressRoutes = require("./routes/address.routes");
const customerRoutes = require("./routes/customer.routes");
const discountRoutes = require("./routes/discount.routes");
const businessOfferRoutes = require("./routes/business-offer.routes");
const profileRoutes = require("./routes/profile.routes");
const paymentRoutes = require("./routes/payment.routes");

// Settings routes
const outletsRoutes = require("./routes/settings/outlets.routes");
const deliveryChargesRoutes = require("./routes/settings/delivery-charges.routes");
const serviceChargesRoutes = require("./routes/settings/service-charges.routes");
const tableOrderingRoutes = require("./routes/settings/table-ordering.routes");

// Initialize Express
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const allowedOrigins = JSON.parse(process.env.ALLOWED_ORIGINS || '["*"]');

// Initialize Socket.IO
const io = initSocket(server);

// override console methods to use logger
require("./utils/logger-override");

// Connect to MongoDB
connectDB();

// logger
app.use(requestLoggerMiddleware());

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-session-id",
    ],
    credentials: false,
  })
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    maxAge: "1h", // Cache for 1 hour
    etag: true,
    lastModified: true,
  })
);

// Add BACKEND_URL to res.locals for use in responses
app.use((req, res, next) => {
  res.locals.backendUrl = BACKEND_URL;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/ordering-times", orderingTimesRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/product-attribute-items", productAttributeItemRoutes);
app.use("/api/settings/lead-times", leadTimesRoutes);
app.use("/api/push-notifications", pushNotificationRoutes);
app.use("/api/repeating-push-notifications", repeatingPushNotificationRoutes);
app.use("/api/price-changes", priceChangesRoutes);
app.use("/api/sms-email-messages", smsEmailMessageRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/business-offers", businessOfferRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/settings/outlets", outletsRoutes);
app.use("/api/settings/delivery-charges", deliveryChargesRoutes);
app.use("/api/settings/service-charges", serviceChargesRoutes);
app.use("/api/settings/table-ordering", tableOrderingRoutes);

// Call initRoles to create default roles if they don't exist
const initRoles = require("./utils/initRoles");
initRoles();

// call cron jobs
const checkPaymentStatusJob = require("./jobs/check-payment-status");
if (process.env.CHECK_PAYMENT_STATUS_CRON) {
  console.log(
    `Cron job checkPaymentStatusJob is enabled, cron expression: ${process.env.CHECK_PAYMENT_STATUS_CRON}`
  );
  checkPaymentStatusJob(process.env.CHECK_PAYMENT_STATUS_CRON).catch(
    (error) => {
      console.error("Error checking payment status:", error);
    }
  );
} else {
  console.log("Cron job checkPaymentStatusJob is not enabled");
}

// Root route
app.get("/", (req, res) => {
  res.send("Restaurant API is running...");
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Server Error",
    error: process.env.NODE_ENV === "production" ? null : err.message,
  });
});

// Start server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log("Socket.IO server is ready for connections");
  });
}

module.exports = { app, server, io };

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Load environment variables if dotenv is available
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not found, using default values');
}

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const categoryRoutes = require('./routes/category.routes');
const orderRoutes = require('./routes/order.routes');
const reservationRoutes = require('./routes/reservation.routes');
const branchRoutes = require('./routes/branch.routes');
const reportRoutes = require('./routes/report.routes');
const roleRoutes = require('./routes/role.routes');
const cartRoutes = require('./routes/cart.routes');
const orderingTimesRoutes = require('./routes/ordering-times.routes');
const attributeRoutes = require('./routes/attribute.routes');
const productAttributeItemRoutes = require('./routes/product-attribute-item.routes');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Add BACKEND_URL to res.locals for use in responses
app.use((req, res, next) => {
  res.locals.backendUrl = BACKEND_URL;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/ordering-times', orderingTimesRoutes);
app.use('/api/attributes', attributeRoutes);
app.use('/api/product-attribute-items', productAttributeItemRoutes);

// Call initRoles to create default roles if they don't exist
const initRoles = require('./utils/initRoles');
initRoles();

// Root route
app.get('/', (req, res) => {
  res.send('Restaurant API is running...');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
  });
}

module.exports = app; 
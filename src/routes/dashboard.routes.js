const express = require('express');
const { getStats } = require('../controllers/dashboard-controller');
// Import authentication middleware
// const { protect, admin } = require('../middleware/auth.middleware');

const dashboardRouter = express.Router();

// Dashboard routes
// router.post('/', protect, admin, getCustomers); 
dashboardRouter.post('/', getStats);

module.exports = dashboardRouter; 
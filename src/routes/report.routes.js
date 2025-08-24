const express = require('express');
const { protect, staff } = require('../middleware/auth.middleware');
const {
  getEndOfNightReport,
  getEndOfMonthReport,
  getSalesHistory,
  getItemSalesHistory,
  getDiscountHistory,
  getOutletReports,
  getCustomReports,
  getDashboardSummary
} = require('../controllers/report.controller');

const router = express.Router();

// Apply authentication and staff role check to all report routes
router.use(protect, staff);

// End of day/night reports
router.get('/end-of-night', getEndOfNightReport);
router.get('/end-of-month', getEndOfMonthReport);

// Sales reports
router.get('/sales-history', getSalesHistory);
router.get('/item-sales-history', getItemSalesHistory);

// Discount reports
router.get('/discount-history', getDiscountHistory);

// Outlet/branch specific reports
router.get('/outlet-reports', getOutletReports);

// Custom reports
router.get('/custom', getCustomReports);

// Dashboard summary metrics
router.get('/dashboard-summary', getDashboardSummary);

module.exports = router; 
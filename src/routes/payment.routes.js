const express = require("express");
const { getPayments, getPaymentStats } = require("../controllers/payment-controller");
const router = express.Router();
// Get payments with filters
router.get("/", getPayments);

// Get payment statistics
router.get("/stats", getPaymentStats);

module.exports = router;

const express = require('express');
const {
  getServiceCharges,
  getServiceCharge,
  createServiceCharge,
  updateServiceCharge,
  deleteServiceCharge,
  calculateServiceCharges,
  getServiceChargeStats,
  getApplicableCharges
} = require('../../controllers/service-charge.controller');

const { protect } = require('../../middleware/auth.middleware');

const router = express.Router();

// Service Charges Routes
router.route('/')
  .get(protect, getServiceCharges)
  .post(protect, createServiceCharge);

router.route('/calculate')
  .post(calculateServiceCharges); // Public endpoint

router.route('/stats')
  .get(protect, getServiceChargeStats);

router.route('/applicable/:orderType')
  .get(getApplicableCharges); // Public endpoint

router.route('/:id')
  .get(protect, getServiceCharge)
  .put(protect, updateServiceCharge)
  .delete(protect, deleteServiceCharge);

module.exports = router; 
const express = require('express');
const {
  getBusinessOffers,
  getBusinessOffer,
  createBusinessOffer,
  updateBusinessOffer,
  deleteBusinessOffer,
  getActiveBusinessOffers,
  trackOfferView,
  trackOfferClick,
  getBusinessOfferStats
} = require('../controllers/business-offer.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Increase payload limits only for business-offer routes to support base64 images
router.use(express.json({ limit: '15mb' }));
router.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Public routes
router.get('/active/:branchId', getActiveBusinessOffers);
router.post('/:id/view', trackOfferView);
router.post('/:id/click', trackOfferClick);

// Protected routes (require authentication)
router.use(protect);

// Admin routes
router.route('/')
  .get(getBusinessOffers)
  .post(createBusinessOffer);

router.get('/stats', getBusinessOfferStats);

router.route('/:id')
  .get(getBusinessOffer)
  .put(updateBusinessOffer)
  .delete(deleteBusinessOffer);

module.exports = router; 
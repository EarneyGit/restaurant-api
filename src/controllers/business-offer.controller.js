const BusinessOffer = require('../models/business-offer.model');
const mongoose = require('mongoose');

// @desc    Get all business offers for a branch
// @route   GET /api/business-offers
// @access  Private (Admin/Manager/Staff only)
const getBusinessOffers = async (req, res) => {
  try {
    // Get user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access business offers'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    const { page = 1, limit = 20, isActive } = req.query;
    
    // Build query
    const query = { branchId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Get offers with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const offers = await BusinessOffer.find(query)
      .populate('createdBy', 'name email')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await BusinessOffer.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: offers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalOffers: total,
        hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getBusinessOffers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get single business offer
// @route   GET /api/business-offers/:id
// @access  Private (Admin/Manager/Staff only)
const getBusinessOffer = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access business offers'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const offer = await BusinessOffer.findOne({
      _id: req.params.id,
      branchId: req.user.branchId
    }).populate('createdBy', 'name email');
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Business offer not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: offer,
      branchId: req.user.branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getBusinessOffer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create new business offer
// @route   POST /api/business-offers
// @access  Private (Admin/Manager/Staff only)
const createBusinessOffer = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create business offers'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Create offer
    const offerData = {
      ...req.body,
      branchId: req.user.branchId,
      createdBy: req.user.id
    };
    
    const offer = await BusinessOffer.create(offerData);
    await offer.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: offer,
      message: 'Business offer created successfully'
    });
    
  } catch (error) {
    console.error('Error in createBusinessOffer:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Update business offer
// @route   PUT /api/business-offers/:id
// @access  Private (Admin/Manager/Staff only)
const updateBusinessOffer = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update business offers'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const offer = await BusinessOffer.findOneAndUpdate(
      { _id: req.params.id, branchId: req.user.branchId },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Business offer not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: offer,
      message: 'Business offer updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updateBusinessOffer:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Delete business offer
// @route   DELETE /api/business-offers/:id
// @access  Private (Admin/Manager/Staff only)
const deleteBusinessOffer = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete business offers'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const offer = await BusinessOffer.findOneAndDelete({
      _id: req.params.id,
      branchId: req.user.branchId
    });
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Business offer not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Business offer deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in deleteBusinessOffer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get active business offers for public display
// @route   GET /api/business-offers/active/:branchId
// @access  Public
const getActiveBusinessOffers = async (req, res) => {
  try {
    const { branchId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid branch ID'
      });
    }
    
    const offers = await BusinessOffer.getActiveOffers(branchId);
    
    res.status(200).json({
      success: true,
      data: offers,
      branchId: branchId
    });
    
  } catch (error) {
    console.error('Error in getActiveBusinessOffers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Track offer view
// @route   POST /api/business-offers/:id/view
// @access  Public
const trackOfferView = async (req, res) => {
  try {
    const offer = await BusinessOffer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Business offer not found'
      });
    }
    
    await offer.incrementViews();
    
    res.status(200).json({
      success: true,
      message: 'View tracked successfully'
    });
    
  } catch (error) {
    console.error('Error in trackOfferView:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Track offer click
// @route   POST /api/business-offers/:id/click
// @access  Public
const trackOfferClick = async (req, res) => {
  try {
    const offer = await BusinessOffer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Business offer not found'
      });
    }
    
    await offer.incrementClicks();
    
    res.status(200).json({
      success: true,
      message: 'Click tracked successfully'
    });
    
  } catch (error) {
    console.error('Error in trackOfferClick:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get business offer statistics
// @route   GET /api/business-offers/stats
// @access  Private (Admin/Manager/Staff only)
const getBusinessOfferStats = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access business offer statistics'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    
    // Get offer statistics
    const stats = await BusinessOffer.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
      {
        $group: {
          _id: null,
          totalOffers: { $sum: 1 },
          activeOffers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          totalViews: { $sum: '$stats.views' },
          totalClicks: { $sum: '$stats.clicks' },
          averageViews: { $avg: '$stats.views' },
          averageClicks: { $avg: '$stats.clicks' }
        }
      }
    ]);
    
    const offerStats = stats.length > 0 ? stats[0] : {
      totalOffers: 0,
      activeOffers: 0,
      totalViews: 0,
      totalClicks: 0,
      averageViews: 0,
      averageClicks: 0
    };
    
    // Calculate click-through rate
    offerStats.clickThroughRate = offerStats.totalViews > 0 
      ? ((offerStats.totalClicks / offerStats.totalViews) * 100).toFixed(2)
      : 0;
    
    // Get top performing offers
    const topOffers = await BusinessOffer.find({ branchId })
      .sort({ 'stats.views': -1 })
      .limit(5)
      .select('title stats.views stats.clicks');
    
    res.status(200).json({
      success: true,
      data: {
        ...offerStats,
        topOffers
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getBusinessOfferStats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

module.exports = {
  getBusinessOffers,
  getBusinessOffer,
  createBusinessOffer,
  updateBusinessOffer,
  deleteBusinessOffer,
  getActiveBusinessOffers,
  trackOfferView,
  trackOfferClick,
  getBusinessOfferStats
}; 
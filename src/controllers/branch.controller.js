const Branch = require('../models/branch.model');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Public
exports.getBranches = async (req, res, next) => {
  try {
    const branches = await Branch.find()
      .populate('manager', 'name email');

    res.status(200).json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Public
exports.getBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id)
      .populate('manager', 'name email');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new branch
// @route   POST /api/branches
// @access  Private/Admin
exports.createBranch = async (req, res, next) => {
  try {
    const branch = await Branch.create(req.body);

    res.status(201).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update branch
// @route   PUT /api/branches/:id
// @access  Private/Admin
exports.updateBranch = async (req, res, next) => {
  try {
    let branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('manager', 'name email');

    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete branch
// @route   DELETE /api/branches/:id
// @access  Private/Admin
exports.deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    // Check if branch has associated users
    const User = require('../models/user.model');
    const users = await User.find({ branchId: req.params.id });
    
    if (users.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete branch with associated users'
      });
    }

    // Check if branch has orders
    const Order = require('../models/order.model');
    const orders = await Order.find({ branch: req.params.id });
    
    if (orders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete branch with associated orders'
      });
    }

    // Check if branch has reservations
    const Reservation = require('../models/reservation.model');
    const reservations = await Reservation.find({ branch: req.params.id });
    
    if (reservations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete branch with associated reservations'
      });
    }

    await branch.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get branches within radius
// @route   GET /api/branches/radius/:zipcode/:distance
// @access  Public
exports.getBranchesInRadius = async (req, res, next) => {
  try {
    const { zipcode, distance } = req.params;

    // Get lat/lng from geocoder
    const loc = await geocodeAddress(zipcode);
    const lat = loc.latitude;
    const lng = loc.longitude;

    // Calc radius using radians
    // Divide dist by radius of Earth
    // Earth Radius = 3,963 mi / 6,378 km
    const radius = distance / 3963;

    const branches = await Branch.find({
      location: {
        $geoWithin: { $centerSphere: [[lng, lat], radius] }
      }
    });

    res.status(200).json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to geocode an address
// This is a placeholder - in a real app, you'd use a geocoding service
const geocodeAddress = async (zipcode) => {
  // Placeholder implementation
  return {
    latitude: 0,
    longitude: 0
  };
}; 
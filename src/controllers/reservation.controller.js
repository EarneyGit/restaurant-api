const Reservation = require('../models/reservation.model');

// @desc    Get all reservations
// @route   GET /api/reservations
// @access  Private/Admin/Manager
exports.getReservations = async (req, res, next) => {
  try {
    let query = {};
    
    // Allow filtering by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Allow filtering by date range
    if (req.query.startDate && req.query.endDate) {
      query.reservationDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    } else if (req.query.date) {
      // Specific date
      const date = new Date(req.query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.reservationDate = {
        $gte: date,
        $lt: nextDay
      };
    }
    
    // Allow filtering by branch
    if (req.query.branch) {
      query.branch = req.query.branch;
    }
    
    // Only return user's reservations if not admin or manager
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.user = req.user._id;
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Reservation.countDocuments(query);
    
    const reservations = await Reservation.find(query)
      .populate('user', 'name email')
      .populate('branch', 'name address')
      .sort({ reservationDate: 1, reservationTime: 1 })
      .skip(startIndex)
      .limit(limit);
    
    // Pagination result
    const pagination = {};
    
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    res.status(200).json({
      success: true,
      count: reservations.length,
      pagination,
      totalPages: Math.ceil(total / limit),
      data: reservations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single reservation
// @route   GET /api/reservations/:id
// @access  Private
exports.getReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('user', 'name email')
      .populate('branch', 'name address');
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `Reservation not found with id of ${req.params.id}`
      });
    }
    
    // Make sure user is the reservation owner or an admin/manager
    if (
      reservation.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' && 
      req.user.role !== 'manager'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this reservation'
      });
    }
    
    res.status(200).json({
      success: true,
      data: reservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new reservation
// @route   POST /api/reservations
// @access  Private
exports.createReservation = async (req, res, next) => {
  try {
    const { 
      name,
      email,
      phone,
      numberOfGuests,
      reservationDate,
      reservationTime,
      specialRequests,
      branch,
      occasion
    } = req.body;
    
    // Create reservation object
    const reservation = new Reservation({
      user: req.user._id,
      name,
      email,
      phone,
      numberOfGuests,
      reservationDate,
      reservationTime,
      specialRequests,
      branch,
      occasion
    });
    
    // Save the reservation
    const savedReservation = await reservation.save();
    
    res.status(201).json({
      success: true,
      data: savedReservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update reservation status
// @route   PUT /api/reservations/:id/status
// @access  Private/Admin/Manager
exports.updateReservationStatus = async (req, res, next) => {
  try {
    const { status, tableNumber } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    let reservation = await Reservation.findById(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `Reservation not found with id of ${req.params.id}`
      });
    }
    
    // Only admin or manager can update status
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update reservation status'
      });
    }
    
    // Update status and table number if provided
    reservation.status = status;
    
    if (tableNumber) {
      reservation.tableNumber = tableNumber;
    }
    
    await reservation.save();
    
    res.status(200).json({
      success: true,
      data: reservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel reservation
// @route   PUT /api/reservations/:id/cancel
// @access  Private
exports.cancelReservation = async (req, res, next) => {
  try {
    let reservation = await Reservation.findById(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `Reservation not found with id of ${req.params.id}`
      });
    }
    
    // Make sure user is the reservation owner or an admin/manager
    if (
      reservation.user.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' && 
      req.user.role !== 'manager'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to cancel this reservation'
      });
    }
    
    // Update status to cancelled
    reservation.status = 'cancelled';
    
    await reservation.save();
    
    res.status(200).json({
      success: true,
      data: reservation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user reservations
// @route   GET /api/reservations/myreservations
// @access  Private
exports.getMyReservations = async (req, res, next) => {
  try {
    const reservations = await Reservation.find({ user: req.user._id })
      .populate('branch', 'name address')
      .sort({ reservationDate: -1, reservationTime: -1 });
    
    res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations
    });
  } catch (error) {
    next(error);
  }
}; 
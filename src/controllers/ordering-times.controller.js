const OrderingTimes = require('../models/ordering-times.model');
const Branch = require('../models/branch.model');

// @desc    Get ordering times for a branch
// @route   GET /api/ordering-times/:branchId
// @access  Private/Admin/Manager
exports.getOrderingTimes = async (req, res, next) => {
  try {
    const { branchId } = req.params;

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branchId !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this branch ordering times'
      });
    }

    let orderingTimes = await OrderingTimes.findOne({ branchId }).populate('branchId', 'name');

    // Create default ordering times if none exist
    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
      await orderingTimes.populate('branchId', 'name');
    }

    res.status(200).json({
      success: true,
      data: orderingTimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update weekly schedule for ordering times
// @route   PUT /api/ordering-times/:branchId/weekly-schedule
// @access  Private/Admin/Manager
exports.updateWeeklySchedule = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { weeklySchedule } = req.body;

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update ordering times
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update ordering times'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other branch ordering times'
        });
      }
    }

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ 
        branchId, 
        weeklySchedule 
      });
    } else {
      orderingTimes.weeklySchedule = weeklySchedule;
      await orderingTimes.save();
    }

    await orderingTimes.populate('branchId', 'name');

    res.status(200).json({
      success: true,
      message: 'Weekly schedule updated successfully',
      data: orderingTimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update specific day ordering times
// @route   PUT /api/ordering-times/:branchId/day/:dayName
// @access  Private/Admin/Manager
exports.updateDaySchedule = async (req, res, next) => {
  try {
    const { branchId, dayName } = req.params;
    const daySettings = req.body;

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(dayName.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day name. Must be one of: ' + validDays.join(', ')
      });
    }

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update ordering times
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update ordering times'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other branch ordering times'
        });
      }
    }

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
    }

    // Update the specific day
    orderingTimes.weeklySchedule[dayName.toLowerCase()] = daySettings;
    await orderingTimes.save();

    await orderingTimes.populate('branchId', 'name');

    res.status(200).json({
      success: true,
      message: `${dayName} schedule updated successfully`,
      data: orderingTimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get closed dates for a branch
// @route   GET /api/ordering-times/:branchId/closed-dates
// @access  Private/Admin/Manager
exports.getClosedDates = async (req, res, next) => {
  try {
    const { branchId } = req.params;

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branchId !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this branch closed dates'
      });
    }

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
    }

    // Filter future closed dates
    const now = new Date();
    const futureClosedDates = orderingTimes.closedDates.filter(closedDate => {
      const compareDate = closedDate.type === 'range' && closedDate.endDate 
        ? closedDate.endDate 
        : closedDate.date;
      return new Date(compareDate) >= now;
    });

    res.status(200).json({
      success: true,
      data: futureClosedDates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add closed date(s)
// @route   POST /api/ordering-times/:branchId/closed-dates
// @access  Private/Admin/Manager
exports.addClosedDate = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { date, type, endDate, reason } = req.body;

    // Validate required fields
    if (!date || !type) {
      return res.status(400).json({
        success: false,
        message: 'Date and type are required'
      });
    }

    if (type === 'range' && !endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date is required for range type'
      });
    }

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot add closed dates
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to add closed dates'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to add closed dates for other branches'
        });
      }
    }

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
    }

    const newClosedDate = {
      date: new Date(date),
      type,
      reason: reason || 'Closed'
    };

    if (type === 'range') {
      newClosedDate.endDate = new Date(endDate);
    }

    orderingTimes.closedDates.push(newClosedDate);
    await orderingTimes.save();

    res.status(201).json({
      success: true,
      message: 'Closed date added successfully',
      data: newClosedDate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete closed date
// @route   DELETE /api/ordering-times/:branchId/closed-dates/:closedDateId
// @access  Private/Admin/Manager
exports.deleteClosedDate = async (req, res, next) => {
  try {
    const { branchId, closedDateId } = req.params;

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot delete closed dates
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to delete closed dates'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete closed dates for other branches'
        });
      }
    }

    const orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      return res.status(404).json({
        success: false,
        message: 'Ordering times not found'
      });
    }

    const closedDateIndex = orderingTimes.closedDates.findIndex(
      date => date._id.toString() === closedDateId
    );

    if (closedDateIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Closed date not found'
      });
    }

    orderingTimes.closedDates.splice(closedDateIndex, 1);
    await orderingTimes.save();

    res.status(200).json({
      success: true,
      message: 'Closed date deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete all closed dates
// @route   DELETE /api/ordering-times/:branchId/closed-dates
// @access  Private/Admin/Manager
exports.deleteAllClosedDates = async (req, res, next) => {
  try {
    const { branchId } = req.params;

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot delete closed dates
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to delete closed dates'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete closed dates for other branches'
        });
      }
    }

    const orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      return res.status(404).json({
        success: false,
        message: 'Ordering times not found'
      });
    }

    orderingTimes.closedDates = [];
    await orderingTimes.save();

    res.status(200).json({
      success: true,
      message: 'All closed dates deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order restrictions for a branch
// @route   GET /api/ordering-times/:branchId/restrictions
// @access  Private/Admin/Manager
exports.getOrderRestrictions = async (req, res, next) => {
  try {
    const { branchId } = req.params;

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branchId !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this branch restrictions'
      });
    }

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
    }

    res.status(200).json({
      success: true,
      data: orderingTimes.restrictions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order restrictions
// @route   PUT /api/ordering-times/:branchId/restrictions
// @access  Private/Admin/Manager
exports.updateOrderRestrictions = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { restrictions } = req.body;

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update restrictions
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update order restrictions'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update restrictions for other branches'
        });
      }
    }

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
    }

    orderingTimes.restrictions = restrictions;
    await orderingTimes.save();

    res.status(200).json({
      success: true,
      message: 'Order restrictions updated successfully',
      data: orderingTimes.restrictions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if ordering is allowed (utility endpoint)
// @route   POST /api/ordering-times/:branchId/check-availability
// @access  Public
exports.checkOrderingAvailability = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { orderType, date, time } = req.body;

    if (!orderType || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Order type, date, and time are required'
      });
    }

    // Check if branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    const orderingTimes = await OrderingTimes.findOne({ branchId });

    if (!orderingTimes) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: 'Ordering times not configured'
      });
    }

    // Check if outlet is closed on the requested date
    const requestDate = new Date(date);
    if (orderingTimes.isClosedOnDate(requestDate)) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: 'Outlet is closed on this date'
      });
    }

    // Get day of week
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[requestDate.getDay()];

    // Check if ordering is allowed for this day and time
    const isAllowed = orderingTimes.isOrderingAllowed(dayName, orderType, time);

    res.status(200).json({
      success: true,
      available: isAllowed,
      reason: isAllowed ? 'Available' : `${orderType} ordering not available at this time`
    });
  } catch (error) {
    next(error);
  }
}; 
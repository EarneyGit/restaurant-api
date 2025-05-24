const OrderingTimes = require('../models/ordering-times.model');
const Branch = require('../models/branch.model');

// @desc    Get ordering times for a branch
// @route   GET /api/ordering-times/:branchId or GET /api/ordering-times (for admin users)
// @access  Private/Admin/Manager
exports.getOrderingTimes = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
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
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branchId.toString() !== req.user.branchId.toString()) {
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
// @route   PUT /api/ordering-times/:branchId/weekly-schedule or PUT /api/ordering-times/weekly-schedule (for admin users)
// @access  Private/Admin/Manager
exports.updateWeeklySchedule = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    const { weeklySchedule } = req.body;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
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
    
    // Staff cannot update ordering times
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update ordering times'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId.toString() !== req.user.branchId.toString()) {
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
// @route   PUT /api/ordering-times/:branchId/day/:dayName or PUT /api/ordering-times/day/:dayName (for admin users)
// @access  Private/Admin/Manager
exports.updateDaySchedule = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    const { dayName } = req.params;
    const daySettings = req.body;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

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
    
    // Staff cannot update ordering times
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update ordering times'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId.toString() !== req.user.branchId.toString()) {
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
// @route   GET /api/ordering-times/:branchId/closed-dates or GET /api/ordering-times/closed-dates (for admin users)
// @access  Private/Admin/Manager
exports.getClosedDates = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
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
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branchId.toString() !== req.user.branchId.toString()) {
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
// @route   POST /api/ordering-times/:branchId/closed-dates or POST /api/ordering-times/closed-dates (for admin users)
// @access  Private/Admin/Manager
exports.addClosedDate = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    const { date, type, endDate, reason } = req.body;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

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
    
    // Staff cannot add closed dates
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to add closed dates'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId.toString() !== req.user.branchId.toString()) {
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
// @route   DELETE /api/ordering-times/:branchId/closed-dates/:closedDateId or DELETE /api/ordering-times/closed-dates/:closedDateId (for admin users)
// @access  Private/Admin/Manager
exports.deleteClosedDate = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    const { closedDateId } = req.params;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
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
    
    // Staff cannot delete closed dates
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to delete closed dates'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId.toString() !== req.user.branchId.toString()) {
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
// @route   DELETE /api/ordering-times/:branchId/closed-dates or DELETE /api/ordering-times/closed-dates (for admin users)
// @access  Private/Admin/Manager
exports.deleteAllClosedDates = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
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
    
    // Staff cannot delete closed dates
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to delete closed dates'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId.toString() !== req.user.branchId.toString()) {
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
// @route   GET /api/ordering-times/:branchId/restrictions or GET /api/ordering-times/restrictions (for admin users)
// @access  Private/Admin/Manager
exports.getOrderRestrictions = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
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
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this branch order restrictions'
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
// @route   PUT /api/ordering-times/:branchId/restrictions or PUT /api/ordering-times/restrictions (for admin users)
// @access  Private/Admin/Manager
exports.updateOrderRestrictions = async (req, res, next) => {
  try {
    let branchId = req.params.branchId;
    const { restrictions } = req.body;
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    // Handle branch determination based on user type
    if (!branchId && isAdmin) {
      // Admin users without branchId in URL: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else if (!branchId) {
      // Non-admin users must provide branchId
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
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
    
    // Staff cannot update restrictions
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update order restrictions'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branchId.toString() !== req.user.branchId.toString()) {
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
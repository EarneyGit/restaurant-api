const OrderingTimes = require('../models/ordering-times.model');
const Branch = require('../models/branch.model');
const { MANAGEMENT_ROLES } = require('../constants/roles');

// Helper function to convert minutes to "X mins" format
const formatLeadTime = (minutes) => {
  return `${minutes} mins`;
};

// Helper function to convert "X mins" format to minutes
const parseLeadTime = (timeString) => {
  const match = timeString.match(/^(\d+)\s*mins?$/i);
  return match ? parseInt(match[1]) : 0;
};

// @desc    Get lead times for a branch (today's settings)
// @route   GET /api/settings/lead-times
// @access  Private/Admin/Manager/Staff
exports.getLeadTimes = async (req, res, next) => {
  try {
    let branchId;
    
    // Get user role from roleId
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    // Admin users use their assigned branchId
    if (isAdmin) {
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
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

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    // Create default ordering times if none exist
    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
    }

    // Get today's day name
    const today = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = dayNames[today.getDay()];
    
    // Get today's settings
    const todaySettings = orderingTimes.weeklySchedule[todayDayName];
    
    // Extract lead times from today's schedule
    const collectionLeadTime = todaySettings?.collection?.leadTime || 20;
    const deliveryLeadTime = todaySettings?.delivery?.leadTime || 45;

    const leadTimes = {
      collection: formatLeadTime(collectionLeadTime),
      delivery: formatLeadTime(deliveryLeadTime),
      day: todayDayName,
      date: today.toISOString().split('T')[0]
    };

    res.status(200).json({
      success: true,
      data: leadTimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lead times for a branch (today's settings)
// @route   PUT /api/settings/lead-times
// @access  Private/Admin/Manager
exports.updateLeadTimes = async (req, res, next) => {
  try {
    let branchId;
    const { collection, delivery } = req.body;
    
    // Get user role from roleId
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    
    // Admin users use their assigned branchId
    if (isAdmin) {
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      branchId = req.user.branchId;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Staff cannot update lead times
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update lead times'
      });
    }

    // Validate input
    if (!collection || !delivery) {
      return res.status(400).json({
        success: false,
        message: 'Both collection and delivery lead times are required'
      });
    }

    // Parse lead times from string format
    const collectionMinutes = parseLeadTime(collection);
    const deliveryMinutes = parseLeadTime(delivery);

    if (collectionMinutes < 0 || deliveryMinutes < 0) {
      return res.status(400).json({
        success: false,
        message: 'Lead times must be positive numbers'
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

    let orderingTimes = await OrderingTimes.findOne({ branchId });

    // Create default ordering times if none exist
    if (!orderingTimes) {
      orderingTimes = await OrderingTimes.create({ branchId });
    }

    // Get today's day name
    const today = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = dayNames[today.getDay()];
    
    // Get today's settings
    let todaySettings = orderingTimes.weeklySchedule[todayDayName];
    
    // If today's settings don't exist, create default settings
    if (!todaySettings) {
      todaySettings = {
        isCollectionAllowed: false,
        isDeliveryAllowed: false,
        isTableOrderingAllowed: false,
        defaultTimes: {
          start: "11:45",
          end: "21:50"
        },
        breakTime: {
          enabled: false,
          start: "15:00",
          end: "16:00"
        },
        collection: {
          useDifferentTimes: false,
          leadTime: 20,
          displayedTime: "12:10",
          customTimes: {
            start: "11:45",
            end: "21:50"
          }
        },
        delivery: {
          useDifferentTimes: false,
          leadTime: 45,
          displayedTime: "12:30",
          customTimes: {
            start: "11:45",
            end: "21:50"
          }
        },
        tableOrdering: {
          useDifferentTimes: false,
          leadTime: 0,
          displayedTime: "",
          customTimes: {
            start: "11:45",
            end: "21:50"
          }
        }
      };
    }

    // Update only the lead times for today
    todaySettings.collection.leadTime = collectionMinutes;
    todaySettings.delivery.leadTime = deliveryMinutes;
    
    // Update the specific day in the weekly schedule
    orderingTimes.weeklySchedule[todayDayName] = todaySettings;
    
    // Mark the weeklySchedule as modified for Mongoose
    orderingTimes.markModified('weeklySchedule');
    await orderingTimes.save();

    const updatedLeadTimes = {
      collection: formatLeadTime(collectionMinutes),
      delivery: formatLeadTime(deliveryMinutes),
      day: todayDayName,
      date: today.toISOString().split('T')[0]
    };

    res.status(200).json({
      success: true,
      message: 'Lead times updated successfully',
      data: updatedLeadTimes
    });
  } catch (error) {
    next(error);
  }
}; 
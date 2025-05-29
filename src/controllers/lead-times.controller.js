const OrderingTimes = require('../models/ordering-times.model');
const Branch = require('../models/branch.model');

// Helper function to convert minutes to "X mins" format
const formatLeadTime = (minutes) => {
  return `${minutes} mins`;
};

// Helper function to convert "X mins" format to minutes
const parseLeadTime = (timeString) => {
  const match = timeString.match(/^(\d+)\s*mins?$/i);
  return match ? parseInt(match[1]) : 0;
};

// @desc    Get lead times for a branch
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

    // Extract lead times from the weekly schedule (use Monday as default)
    const mondaySchedule = orderingTimes.weeklySchedule.monday;
    const collectionLeadTime = mondaySchedule?.collection?.leadTime || 20;
    const deliveryLeadTime = mondaySchedule?.delivery?.leadTime || 45;

    const leadTimes = {
      collection: formatLeadTime(collectionLeadTime),
      delivery: formatLeadTime(deliveryLeadTime)
    };

    res.status(200).json({
      success: true,
      data: leadTimes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lead times for a branch
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

    // Update lead times for all days of the week while preserving existing structure
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    daysOfWeek.forEach(day => {
      // Ensure the day exists in weeklySchedule
      if (!orderingTimes.weeklySchedule[day]) {
        orderingTimes.weeklySchedule[day] = {
          isCollectionAllowed: false,
          isDeliveryAllowed: false,
          isTableOrderingAllowed: false,
          defaultTimes: {
            start: "11:45",
            end: "21:50"
          },
          collection: {
            leadTime: 20,
            displayedTime: "12:10"
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
      } else {
        // Ensure required fields exist if day already exists
        if (!orderingTimes.weeklySchedule[day].defaultTimes) {
          orderingTimes.weeklySchedule[day].defaultTimes = {
            start: "11:45",
            end: "21:50"
          };
        }
        if (!orderingTimes.weeklySchedule[day].collection) {
          orderingTimes.weeklySchedule[day].collection = {
            leadTime: 20,
            displayedTime: "12:10"
          };
        }
        if (!orderingTimes.weeklySchedule[day].delivery) {
          orderingTimes.weeklySchedule[day].delivery = {
            useDifferentTimes: false,
            leadTime: 45,
            displayedTime: "12:30",
            customTimes: {
              start: "11:45",
              end: "21:50"
            }
          };
        }
      }
      
      // Update only the lead times
      orderingTimes.weeklySchedule[day].collection.leadTime = collectionMinutes;
      orderingTimes.weeklySchedule[day].delivery.leadTime = deliveryMinutes;
    });

    // Mark the weeklySchedule as modified for Mongoose
    orderingTimes.markModified('weeklySchedule');
    await orderingTimes.save();

    const updatedLeadTimes = {
      collection: formatLeadTime(collectionMinutes),
      delivery: formatLeadTime(deliveryMinutes)
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
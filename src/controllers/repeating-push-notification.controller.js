const RepeatingPushNotification = require('../models/repeating-push-notification.model');
const { getIO } = require('../utils/socket');

// @desc    Get all repeating push notifications for admin's branch
// @route   GET /api/repeating-push-notifications
// @access  Private (Admin only)
const getRepeatingPushNotifications = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const { status, limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const query = { branchId, isActive: true };
    if (status) {
      query.status = status;
    }

    const notifications = await RepeatingPushNotification.find(query)
      .populate('createdBy', 'name email')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await RepeatingPushNotification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: notifications.length,
        totalRecords: total
      }
    });
  } catch (error) {
    console.error('Error fetching repeating push notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching repeating push notifications',
      error: error.message
    });
  }
};

// @desc    Get single repeating push notification
// @route   GET /api/repeating-push-notifications/:id
// @access  Private (Admin only)
const getRepeatingPushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { id } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const notification = await RepeatingPushNotification.findOne({
      _id: id,
      branchId,
      isActive: true
    })
      .populate('createdBy', 'name email')
      .populate('branchId', 'name');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Repeating push notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error fetching repeating push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching repeating push notification',
      error: error.message
    });
  }
};

// @desc    Create new repeating push notification
// @route   POST /api/repeating-push-notifications
// @access  Private (Admin only)
const createRepeatingPushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const userId = req.user.id;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const { messageText, startRun, endRun, status, frequency, interval } = req.body;

    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required'
      });
    }

    if (!startRun || !endRun) {
      return res.status(400).json({
        success: false,
        message: 'Start run and end run dates are required'
      });
    }

    const startDate = new Date(startRun);
    const endDate = new Date(endRun);

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End run date must be after start run date'
      });
    }

    if (startDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Start run date must be in the future'
      });
    }

    // Create notification
    const notificationData = {
      branchId,
      messageText: messageText.trim(),
      startRun: startDate,
      endRun: endDate,
      status: status || 'active',
      createdBy: userId,
      frequency: frequency || 'daily',
      interval: interval || 1,
      nextRun: startDate
    };

    const notification = await RepeatingPushNotification.create(notificationData);

    // Populate the created notification
    await notification.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'branchId', select: 'name' }
    ]);

    // Emit socket event for real-time updates to user apps only
    const io = getIO();
    if (io) {
      // Emit to user apps for this branch (they will handle showing the notification when it's due)
      io.to(`users_${branchId}`).emit('repeating_notification_created', {
        id: notification._id,
        messageText: notification.messageText,
        branchId,
        startRun: notification.startRun,
        endRun: notification.endRun,
        nextRun: notification.nextRun,
        frequency: notification.frequency,
        interval: notification.interval,
        status: notification.status,
        timestamp: new Date()
      });

      console.log(`Socket event emitted for new repeating notification: ${notification._id}`);
    }

    res.status(201).json({
      success: true,
      message: 'Repeating push notification created successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error creating repeating push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating repeating push notification',
      error: error.message
    });
  }
};

// @desc    Update repeating push notification
// @route   PUT /api/repeating-push-notifications/:id
// @access  Private (Admin only)
const updateRepeatingPushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { id } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const notification = await RepeatingPushNotification.findOne({
      _id: id,
      branchId,
      isActive: true
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Repeating push notification not found'
      });
    }

    const { messageText, startRun, endRun, status, frequency, interval } = req.body;

    // Update fields
    if (messageText !== undefined) notification.messageText = messageText.trim();
    if (status !== undefined) notification.status = status;
    if (frequency !== undefined) notification.frequency = frequency;
    if (interval !== undefined) notification.interval = interval;

    // Handle date updates
    if (startRun !== undefined) {
      const startDate = new Date(startRun);
      if (startDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Start run date must be in the future'
        });
      }
      notification.startRun = startDate;
      // Reset nextRun if start date changed
      if (!notification.lastRun) {
        notification.nextRun = startDate;
      }
    }

    if (endRun !== undefined) {
      const endDate = new Date(endRun);
      if (endDate <= notification.startRun) {
        return res.status(400).json({
          success: false,
          message: 'End run date must be after start run date'
        });
      }
      notification.endRun = endDate;
    }

    await notification.save();
    await notification.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'branchId', select: 'name' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Repeating push notification updated successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error updating repeating push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating repeating push notification',
      error: error.message
    });
  }
};

// @desc    Delete repeating push notification
// @route   DELETE /api/repeating-push-notifications/:id
// @access  Private (Admin only)
const deleteRepeatingPushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { id } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const notification = await RepeatingPushNotification.findOne({
      _id: id,
      branchId,
      isActive: true
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Repeating push notification not found'
      });
    }

    // Soft delete
    notification.isActive = false;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Repeating push notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting repeating push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting repeating push notification',
      error: error.message
    });
  }
};

// @desc    Toggle status of repeating push notification
// @route   PATCH /api/repeating-push-notifications/:id/toggle-status
// @access  Private (Admin only)
const toggleRepeatingPushNotificationStatus = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { id } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const notification = await RepeatingPushNotification.findOne({
      _id: id,
      branchId,
      isActive: true
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Repeating push notification not found'
      });
    }

    await notification.toggleStatus();
    await notification.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'branchId', select: 'name' }
    ]);

    res.status(200).json({
      success: true,
      message: `Repeating push notification ${notification.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: notification
    });
  } catch (error) {
    console.error('Error toggling repeating push notification status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling repeating push notification status',
      error: error.message
    });
  }
};

// @desc    Get notification statistics for branch
// @route   GET /api/repeating-push-notifications/stats
// @access  Private (Admin only)
const getRepeatingNotificationStats = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const stats = await RepeatingPushNotification.aggregate([
      { $match: { branchId: branchId, isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalExecutions: { $sum: '$metadata.totalExecutions' },
          successfulExecutions: { $sum: '$metadata.successfulExecutions' },
          failedExecutions: { $sum: '$metadata.failedExecutions' }
        }
      }
    ]);

    const totalNotifications = await RepeatingPushNotification.countDocuments({
      branchId,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalNotifications,
        byStatus: stats,
        summary: stats.reduce((acc, stat) => {
          acc.totalExecutions += stat.totalExecutions;
          acc.successfulExecutions += stat.successfulExecutions;
          acc.failedExecutions += stat.failedExecutions;
          return acc;
        }, { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0 })
      }
    });
  } catch (error) {
    console.error('Error fetching repeating notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching repeating notification statistics',
      error: error.message
    });
  }
};

module.exports = {
  getRepeatingPushNotifications,
  getRepeatingPushNotification,
  createRepeatingPushNotification,
  updateRepeatingPushNotification,
  deleteRepeatingPushNotification,
  toggleRepeatingPushNotificationStatus,
  getRepeatingNotificationStats
}; 
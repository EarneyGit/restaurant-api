const PushNotification = require('../models/push-notification.model');
const { getIO } = require('../utils/socket');

// @desc    Get all push notifications for admin's branch
// @route   GET /api/push-notifications
// @access  Private (Admin only)
const getPushNotifications = async (req, res) => {
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

    const notifications = await PushNotification.find(query)
      .populate('createdBy', 'name email')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await PushNotification.countDocuments(query);

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
    console.error('Error fetching push notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching push notifications',
      error: error.message
    });
  }
};

// @desc    Get single push notification
// @route   GET /api/push-notifications/:id
// @access  Private (Admin only)
const getPushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { id } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const notification = await PushNotification.findOne({
      _id: id,
      branchId,
      isActive: true
    })
      .populate('createdBy', 'name email')
      .populate('branchId', 'name');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Push notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error fetching push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching push notification',
      error: error.message
    });
  }
};

// @desc    Create new push notification
// @route   POST /api/push-notifications
// @access  Private (Admin only)
const createPushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const userId = req.user.id;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const { text, title, scheduledTime, targetAudience } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Notification text is required'
      });
    }

    // Create notification
    const notificationData = {
      branchId,
      text: text.trim(),
      title: title?.trim() || 'New Notification',
      createdBy: userId,
      targetAudience: targetAudience || 'all'
    };

    // Handle scheduled time
    if (scheduledTime) {
      const scheduleDate = new Date(scheduledTime);
      if (scheduleDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled time must be in the future'
        });
      }
      notificationData.scheduledTime = scheduleDate;
    }

    const notification = await PushNotification.create(notificationData);

    // Populate the created notification
    await notification.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'branchId', select: 'name' }
    ]);

    // Emit socket event for real-time updates to user apps only
    const io = getIO();
    if (io) {
      // Emit to user apps for this branch (they will handle showing the notification)
      io.to(`users_${branchId}`).emit('new_push_notification', {
        id: notification._id,
        text: notification.text,
        title: notification.title,
        branchId,
        scheduledTime: notification.scheduledTime,
        targetAudience: notification.targetAudience,
        timestamp: new Date()
      });

      console.log(`Socket event emitted for new notification: ${notification._id}`);
    }

    res.status(201).json({
      success: true,
      message: 'Push notification created successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error creating push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating push notification',
      error: error.message
    });
  }
};

// @desc    Update push notification
// @route   PUT /api/push-notifications/:id
// @access  Private (Admin only)
const updatePushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { id } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const notification = await PushNotification.findOne({
      _id: id,
      branchId,
      isActive: true
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Push notification not found'
      });
    }

    // Only allow updates for scheduled notifications
    if (notification.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update sent notifications'
      });
    }

    const { text, title, scheduledTime, targetAudience, status } = req.body;

    // Update fields
    if (text !== undefined) notification.text = text.trim();
    if (title !== undefined) notification.title = title.trim();
    if (targetAudience !== undefined) notification.targetAudience = targetAudience;
    if (status !== undefined) notification.status = status;

    // Handle scheduled time update
    if (scheduledTime !== undefined) {
      if (scheduledTime) {
        const scheduleDate = new Date(scheduledTime);
        if (scheduleDate <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Scheduled time must be in the future'
          });
        }
        notification.scheduledTime = scheduleDate;
      } else {
        notification.scheduledTime = null;
      }
    }

    await notification.save();
    await notification.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'branchId', select: 'name' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Push notification updated successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error updating push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating push notification',
      error: error.message
    });
  }
};

// @desc    Delete push notification
// @route   DELETE /api/push-notifications/:id
// @access  Private (Admin only)
const deletePushNotification = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { id } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const notification = await PushNotification.findOne({
      _id: id,
      branchId,
      isActive: true
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Push notification not found'
      });
    }

    // Soft delete
    notification.isActive = false;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Push notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting push notification',
      error: error.message
    });
  }
};

// @desc    Get notification statistics for branch
// @route   GET /api/push-notifications/stats
// @access  Private (Admin only)
const getNotificationStats = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    const stats = await PushNotification.aggregate([
      { $match: { branchId: branchId, isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRecipients: { $sum: '$metadata.totalRecipients' },
          successfulDeliveries: { $sum: '$metadata.successfulDeliveries' },
          failedDeliveries: { $sum: '$metadata.failedDeliveries' }
        }
      }
    ]);

    const totalNotifications = await PushNotification.countDocuments({
      branchId,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalNotifications,
        byStatus: stats,
        summary: stats.reduce((acc, stat) => {
          acc.totalRecipients += stat.totalRecipients;
          acc.successfulDeliveries += stat.successfulDeliveries;
          acc.failedDeliveries += stat.failedDeliveries;
          return acc;
        }, { totalRecipients: 0, successfulDeliveries: 0, failedDeliveries: 0 })
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification statistics',
      error: error.message
    });
  }
};

module.exports = {
  getPushNotifications,
  getPushNotification,
  createPushNotification,
  updatePushNotification,
  deletePushNotification,
  getNotificationStats
}; 
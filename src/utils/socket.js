const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const { ALL_ROLES } = require('../constants/roles');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Handle user app joining branch room
    socket.on('join_user_branch', (branchId) => {
      if (branchId) {
        socket.join(`users_${branchId}`);
        console.log(`User socket ${socket.id} joined user room: users_${branchId}`);
      }
    });

    // Handle restaurant staff joining their branch room
    socket.on('join_restaurant', async (data) => {
      try {
        const { token } = data;
        
        if (!token) {
          socket.emit('auth_error', { message: 'Token required' });
          return;
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'restaurant_api_secret_key');
        const user = await User.findById(decoded.id).populate('branchId');
        const roleDoc = await Role.findById(user.roleId);
        if (roleDoc) {
          user.role = roleDoc.slug;
        }
        if (!user) {
          socket.emit('auth_error', { message: 'User not found' });
          return;
        }

        // Check if user is restaurant staff
        const allowedRoles = ALL_ROLES;
        if (!allowedRoles.includes(user.role)) {
          socket.emit('auth_error', { message: 'Unauthorized role' });
          return;
        }

        if (!user.branchId) {
          socket.emit('auth_error', { message: 'User not assigned to a branch' });
          return;
        }

        // Join restaurant room for their branch
        const roomName = `restaurant_${user.branchId}`;
        socket.join(roomName);
        socket.userId = user._id;
        socket.branchId = user.branchId;
        socket.userRole = user.role;
        
        console.log(`Restaurant staff ${user.name} (${socket.id}) joined room: ${roomName}`);
        socket.emit('joined_restaurant', { 
          message: 'Successfully joined restaurant room',
          branchId: user.branchId,
          role: user.role 
        });

      } catch (error) {
        console.error('Error in join_restaurant:', error);
        socket.emit('auth_error', { message: 'Authentication failed' });
      }
    });

    // Handle leaving rooms
    socket.on('leave_branch', (branchId) => {
      if (branchId) {
        socket.leave(`users_${branchId}`);
        console.log(`Socket ${socket.id} left user room for: ${branchId}`);
      }
    });

    // Handle notification acknowledgment from user apps
    socket.on('notification_received', (data) => {
      const { notificationId, branchId, userId } = data;
      console.log(`Notification ${notificationId} received by user ${userId} in branch ${branchId}`);
    });

    // Handle notification click tracking
    socket.on('notification_clicked', (data) => {
      const { notificationId, branchId, userId } = data;
      console.log(`Notification ${notificationId} clicked by user ${userId} in branch ${branchId}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Handle server-level socket errors
  io.on('error', (error) => {
    console.error('Socket.IO server error:', error);
  });

  console.log('Socket.IO server initialized');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket first.');
  }
  return io;
};

// Utility function to emit to users of specific branch
const emitToUsers = (branchId, event, data) => {
  if (io) {
    io.to(`users_${branchId}`).emit(event, data);
  }
};

// Utility function to emit to restaurant staff of specific branch
const emitToRestaurant = (branchId, event, data) => {
  if (io) {
    io.to(`restaurant_${branchId}`).emit(event, data);
    console.log(`Emitted ${event} to restaurant_${branchId}:`, data);
  }
};

// Common function to emit order events - matches frontend 'order' event listener
const emitOrderEvent = (branchId, eventType, orderData) => {
  if (!io) return;
  
  // Create message based on event type
  const eventMessages = {
    'order_created': 'New order received',
    'order_updated': 'Order updated', 
    'order_cancelled': 'Order cancelled',
    'order_deleted': 'Order deleted',
    'order_status_changed': 'Order status changed'
  };

  const message = eventMessages[eventType] || 'Order event';

  // Structure data exactly as frontend expects for 'order' event
  const socketData = {
    message,
    type: eventType,
    orderId: orderData.orderId,
    orderNumber: orderData.orderNumber,
    branchId: branchId,
    timestamp: new Date().toISOString(),
    // Include status information if provided
    ...(orderData.oldStatus && { oldStatus: orderData.oldStatus }),
    ...(orderData.newStatus && { newStatus: orderData.newStatus })
  };

  // Emit to the 'order' event that frontend is listening to
  io.to(`restaurant_${branchId}`).emit('order', socketData);
  console.log(`Emitted order event to restaurant_${branchId}:`, socketData);
};

// Utility function to get connected user sockets count for a branch
const getUserSocketsCount = (branchId) => {
  if (!io) return 0;
  
  const userRoom = io.sockets.adapter.rooms.get(`users_${branchId}`);
  return userRoom ? userRoom.size : 0;
};

// Utility function to get connected restaurant staff count for a branch
const getRestaurantSocketsCount = (branchId) => {
  if (!io) return 0;
  
  const restaurantRoom = io.sockets.adapter.rooms.get(`restaurant_${branchId}`);
  return restaurantRoom ? restaurantRoom.size : 0;
};

module.exports = {
  initSocket,
  getIO,
  emitToUsers,
  emitToRestaurant,
  emitOrderEvent,
  getUserSocketsCount,
  getRestaurantSocketsCount
}; 
const { Server } = require('socket.io');

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

// Utility function to get connected user sockets count for a branch
const getUserSocketsCount = (branchId) => {
  if (!io) return 0;
  
  const userRoom = io.sockets.adapter.rooms.get(`users_${branchId}`);
  return userRoom ? userRoom.size : 0;
};

module.exports = {
  initSocket,
  getIO,
  emitToUsers,
  getUserSocketsCount
}; 
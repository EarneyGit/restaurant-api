const mongoose = require('mongoose');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const bcrypt = require('bcryptjs');

// MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/restaurant-api';

// Admin user details
const adminUser = {
  email: 'admin@restaurant.com',
  password: 'Admin@123',
  firstName: 'Admin',
  lastName: 'User',
  emailVerified: true
};

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create default roles if they don't exist
    await Role.createDefaultRoles();
    console.log('Roles initialized');

    // Find admin role
    const adminRole = await Role.findOne({ slug: 'admin' });
    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    // Check if admin user already exists
    let adminUserDoc = await User.findOne({ email: adminUser.email });
    
    if (adminUserDoc) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    adminUserDoc = await User.create({
      ...adminUser,
      roleId: adminRole._id
    });

    console.log('Admin user created successfully:', {
      email: adminUserDoc.email,
      role: 'admin'
    });

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser(); 
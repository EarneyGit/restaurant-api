const mongoose = require('mongoose');
const Role = require('../models/role.model');

// Load environment variables if dotenv is available
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not found, using default values');
}

// Connect to database
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-api';
mongoose.connect(mongoURI)
  .then(() => console.log(`MongoDB Connected: ${mongoose.connection.host}`))
  .catch(err => {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  });

// Define default roles
const defaultRoles = [
  {
    name: 'Super Admin',
    slug: 'superadmin',
    description: 'Super Admin with full access',
    isSystemRole: true,
    displayOrder: 1
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'System administrator with full access',
    isSystemRole: true,
    displayOrder: 2
  },
  {
    name: 'Manager',
    slug: 'manager',
    description: 'Branch manager with limited admin access',
    isSystemRole: true,
    displayOrder: 3
  },
  {
    name: 'Staff',
    slug: 'staff',
    description: 'Restaurant staff with operational access',
    isSystemRole: true,
    displayOrder: 4
  },
  {
    name: 'User',
    slug: 'user',
    description: 'Regular customer account',
    isSystemRole: true,
    displayOrder: 5
  }
];

// Seed roles to database
const seedRoles = async () => {
  try {
    // Try to drop the collection first to avoid any duplicate key errors
    try {
      await mongoose.connection.db.dropCollection('roles');
      console.log('Existing roles collection dropped');
    } catch (err) {
      console.log('No existing roles collection to drop');
    }

    // Insert default roles
    const roles = await Role.insertMany(defaultRoles);
    
    console.log(`${roles.length} roles seeded successfully`);
    console.log('Roles:', roles.map(role => `${role.name} (${role.slug})`).join(', '));
    
    process.exit(0);
  } catch (error) {
    console.error(`Error seeding roles: ${error.message}`);
    process.exit(1);
  }
};

seedRoles(); 
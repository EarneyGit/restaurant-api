const mongoose = require('mongoose');
const Role = require('../models/role.model');

// Load environment variables if dotenv is available
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not found, using default values');
}

// Connect to database
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant';
mongoose.connect(mongoURI)
  .then(() => console.log(`MongoDB Connected: ${mongoose.connection.host}`))
  .catch(err => {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  });

// Define standard system roles
const systemRoles = [
  {
    name: 'Admin',
    slug: 'admin',
    description: 'System administrator with full access',
    isSystemRole: true,
    isActive: true,
    displayOrder: 1
  },
  {
    name: 'Manager',
    slug: 'manager',
    description: 'Branch manager with limited admin access',
    isSystemRole: true,
    isActive: true,
    displayOrder: 2
  },
  {
    name: 'Staff',
    slug: 'staff',
    description: 'Restaurant staff with operational access',
    isSystemRole: true,
    isActive: true,
    displayOrder: 3
  },
  {
    name: 'User',
    slug: 'user',
    description: 'Regular customer account',
    isSystemRole: true,
    isActive: true,
    displayOrder: 4
  }
];

const manageRoles = async () => {
  try {
    // Get all existing roles
    const existingRoles = await Role.find({});
    console.log(`Found ${existingRoles.length} existing roles in database:`);
    
    const existingSlugs = existingRoles.map(role => role.slug);
    console.log('Existing role slugs:', existingSlugs);
    
    // Insert roles that don't exist yet
    for (const roleData of systemRoles) {
      if (!existingSlugs.includes(roleData.slug)) {
        console.log(`Adding missing role: ${roleData.name} (${roleData.slug})`);
        
        try {
          const newRole = new Role(roleData);
          const savedRole = await newRole.save();
          console.log(`Role ${roleData.name} created with ID: ${savedRole._id}`);
        } catch (err) {
          console.error(`Error creating role ${roleData.name}: ${err.message}`);
          
          // Try using direct MongoDB insertion if Mongoose validation fails
          if (err.name === 'ValidationError' || err.code === 11000) {
            try {
              await mongoose.connection.db.collection('roles').insertOne({
                ...roleData,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              console.log(`Role ${roleData.name} force-inserted successfully`);
            } catch (forceErr) {
              console.error(`Force insertion failed for ${roleData.name}: ${forceErr.message}`);
            }
          }
        }
      } else {
        console.log(`Role ${roleData.name} already exists, checking if update needed...`);
        
        // Check if any fields need updating
        const existingRole = existingRoles.find(r => r.slug === roleData.slug);
        let needsUpdate = false;
        
        if (!existingRole.isActive && roleData.isActive) {
          needsUpdate = true;
          console.log(`Role ${roleData.name} needs to be activated`);
        }
        
        if (existingRole.description !== roleData.description) {
          needsUpdate = true;
          console.log(`Role ${roleData.name} description needs update`);
        }
        
        if (needsUpdate) {
          const result = await Role.updateOne(
            { slug: roleData.slug },
            { 
              $set: { 
                isActive: roleData.isActive,
                description: roleData.description
              }
            }
          );
          console.log(`Updated role ${roleData.name}: ${JSON.stringify(result)}`);
        }
      }
    }
    
    // List all roles after management
    const finalRoles = await Role.find({}).sort({ displayOrder: 1 });
    console.log(`\nFinal roles in database (${finalRoles.length}):`);
    finalRoles.forEach(role => {
      console.log(`- ${role.name} (${role.slug}), isActive: ${role.isActive}, isSystemRole: ${role.isSystemRole}, displayOrder: ${role.displayOrder}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

manageRoles(); 
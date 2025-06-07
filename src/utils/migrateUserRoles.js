const mongoose = require('mongoose');
const User = require('../models/user.model');
const Role = require('../models/role.model');

// Load environment variables if dotenv is available
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not found, using default values');
}

// Connect to database
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
  .then(() => console.log(`MongoDB Connected: ${mongoose.connection.host}`))
  .catch(err => {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  });

// Migrate users from legacy role strings to roleId references
const migrateUsers = async () => {
  try {
    // First, make sure system roles exist
    const roles = await Role.find({ isSystemRole: true });
    
    if (roles.length < 4) {
      console.error('System roles not found. Please run seedRoles.js first.');
      process.exit(1);
    }
    
    // Create a mapping of role strings to role IDs
    const roleMap = {};
    roles.forEach(role => {
      const legacyRoleName = role.name.toLowerCase();
      roleMap[legacyRoleName] = role._id;
    });
    
    // Get count of users that need migration
    const usersToMigrate = await User.countDocuments({ roleId: { $exists: false } });
    
    if (usersToMigrate === 0) {
      console.log('No users need migration.');
      process.exit(0);
    }
    
    console.log(`Found ${usersToMigrate} users to migrate...`);
    
    // Update users in batches
    const batchSize = 100;
    let processedCount = 0;
    
    // Process users in batches
    for (let skip = 0; skip < usersToMigrate; skip += batchSize) {
      const users = await User.find({ roleId: { $exists: false } })
        .limit(batchSize);
      
      for (const user of users) {
        const legacyRole = user.role || 'user';
        const roleId = roleMap[legacyRole];
        
        if (!roleId) {
          console.warn(`Role not found for user ${user._id} with legacy role ${legacyRole}`);
          continue;
        }
        
        // Update user with new roleId
        user.roleId = roleId;
        await user.save({ validateBeforeSave: false });
        
        processedCount++;
        if (processedCount % 50 === 0) {
          console.log(`Processed ${processedCount} users...`);
        }
      }
    }
    
    console.log(`Migration complete. ${processedCount} users updated.`);
    process.exit(0);
  } catch (error) {
    console.error(`Error during migration: ${error.message}`);
    process.exit(1);
  }
};

migrateUsers(); 
const mongoose = require('mongoose');
const seedBranchData = require('../src/utils/seedBranchData');

// Load environment variables
require('dotenv').config();

const runSeed = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant-api';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Run the seed
    await seedBranchData();

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error running seed:', error);
    process.exit(1);
  }
};

runSeed(); 
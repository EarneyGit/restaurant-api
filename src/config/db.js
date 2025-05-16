const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Using environment variable or default URI if not set
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant';
    
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB; 
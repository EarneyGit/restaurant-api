const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Using environment variable or default URI if not set
    const mongoURI = process.env.MONGODB_URI;
    const conn = await mongoose.connect(mongoURI);
    console.log(`ConnectDB: MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error in ConnectDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB; 
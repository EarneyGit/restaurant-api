const mongoose = require('mongoose');

/**
 * Get a model by name, safely handling circular dependencies
 * @param {string} modelName - The name of the model to get
 * @returns The mongoose model
 */
const getModel = (modelName) => {
  try {
    return mongoose.model(modelName);
  } catch (error) {
    console.error(`Error getting model ${modelName}:`, error.message);
    return null;
  }
};

module.exports = {
  getModel
}; 
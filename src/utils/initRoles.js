const Role = require('../models/role.model');

/**
 * Initialize default roles if they don't exist
 */
const initRoles = async () => {
  try {
    // Call the static method on the Role model
    await Role.createDefaultRoles();
  } catch (error) {
    console.error('Error initializing roles:', error);
  }
};

module.exports = initRoles; 
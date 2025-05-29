// Role constants for the restaurant management system

// All available roles in the system
const ALL_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  USER: 'user'
};

// Roles allowed for branch management operations
const BRANCH_MANAGEMENT_ROLES = [
  ALL_ROLES.SUPERADMIN,
  ALL_ROLES.ADMIN,
  ALL_ROLES.MANAGER,
  ALL_ROLES.STAFF
];

// Alias for backward compatibility
const MANAGEMENT_ROLES = BRANCH_MANAGEMENT_ROLES;

// Roles that require branch assignment
const BRANCH_ASSIGNMENT_REQUIRED_ROLES = [
  ALL_ROLES.MANAGER,
  ALL_ROLES.STAFF
];

// Roles that have full system access
const SYSTEM_ADMIN_ROLES = [
  ALL_ROLES.SUPERADMIN,
  ALL_ROLES.ADMIN
];

// Roles restricted from certain branch operations
const RESTRICTED_BRANCH_ROLES = [
  ALL_ROLES.MANAGER,
  ALL_ROLES.STAFF
];

module.exports = {
  ALL_ROLES: Object.values(ALL_ROLES),
  BRANCH_MANAGEMENT_ROLES,
  MANAGEMENT_ROLES,
  BRANCH_ASSIGNMENT_REQUIRED_ROLES,
  SYSTEM_ADMIN_ROLES,
  RESTRICTED_BRANCH_ROLES
}; 
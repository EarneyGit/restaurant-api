const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/user.controller');

const { protect, admin } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply protect and admin middleware to all routes
router.use(protect, admin);

// Routes
router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router; 
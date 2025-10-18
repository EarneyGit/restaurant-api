const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateUserDeliveryAddress,
  deleteUserDeliveryAddress
} = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes are now public
router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

router.route('/delivery/address')
  .put(protect, updateUserDeliveryAddress)
  .delete(protect, deleteUserDeliveryAddress);

module.exports = router; 
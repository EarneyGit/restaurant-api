const express = require('express');
const {
  getTableGroups,
  getTableGroup,
  createTableGroup,
  updateTableGroup,
  deleteTableGroup,
  addTableToGroup,
  updateTableInGroup,
  removeTableFromGroup,
  generateTableQR,
  getAvailableTables,
  getTableByQR,
  getTableOrderingStats
} = require('../../controllers/table-ordering.controller');

const { protect } = require('../../middleware/auth.middleware');

const router = express.Router();

// Table Groups Routes
router.route('/')
  .get(protect, getTableGroups)
  .post(protect, createTableGroup);

router.route('/stats')
  .get(protect, getTableOrderingStats);

router.route('/available/:branchId')
  .get(getAvailableTables); // Public endpoint

router.route('/qr/:qrCode')
  .get(getTableByQR); // Public endpoint

router.route('/:id')
  .get(protect, getTableGroup)
  .put(protect, updateTableGroup)
  .delete(protect, deleteTableGroup);

// Table Management Routes
router.route('/:groupId/tables')
  .post(protect, addTableToGroup);

router.route('/:groupId/tables/:tableId')
  .put(protect, updateTableInGroup)
  .delete(protect, removeTableFromGroup);

router.route('/:groupId/tables/:tableId/qr')
  .post(protect, generateTableQR);

module.exports = router; 
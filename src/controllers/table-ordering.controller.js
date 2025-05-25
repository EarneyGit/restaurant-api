const TableGroup = require('../models/table-ordering.model');
const mongoose = require('mongoose');

// @desc    Get all table groups for a branch
// @route   GET /api/settings/table-ordering
// @access  Private (Admin/Manager/Staff only)
const getTableGroups = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access table groups'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    const { page = 1, limit = 20, isEnabled, includeDisabled = false } = req.query;
    
    // Build query
    const query = { branchId };
    if (!includeDisabled || includeDisabled === 'false') {
      query.isEnabled = true;
    }
    if (isEnabled !== undefined) {
      query.isEnabled = isEnabled === 'true';
    }
    
    // Get groups with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const groups = await TableGroup.find(query)
      .populate('createdBy', 'name email')
      .sort({ displayOrder: 1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await TableGroup.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: groups,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalGroups: total,
        hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getTableGroups:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get single table group
// @route   GET /api/settings/table-ordering/:id
// @access  Private (Admin/Manager/Staff only)
const getTableGroup = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access table groups'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const group = await TableGroup.findOne({
      _id: req.params.id,
      branchId: req.user.branchId
    }).populate('createdBy', 'name email');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: group,
      branchId: req.user.branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getTableGroup:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Create new table group
// @route   POST /api/settings/table-ordering
// @access  Private (Admin/Manager/Staff only)
const createTableGroup = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can create table groups'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Create group
    const groupData = {
      ...req.body,
      branchId: req.user.branchId,
      createdBy: req.user.id
    };
    
    const group = await TableGroup.create(groupData);
    await group.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: group,
      message: 'Table group created successfully'
    });
    
  } catch (error) {
    console.error('Error in createTableGroup:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Update table group
// @route   PUT /api/settings/table-ordering/:id
// @access  Private (Admin/Manager/Staff only)
const updateTableGroup = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update table groups'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const group = await TableGroup.findOneAndUpdate(
      { _id: req.params.id, branchId: req.user.branchId },
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: group,
      message: 'Table group updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updateTableGroup:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Delete table group
// @route   DELETE /api/settings/table-ordering/:id
// @access  Private (Admin/Manager/Staff only)
const deleteTableGroup = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete table groups'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const group = await TableGroup.findOneAndDelete({
      _id: req.params.id,
      branchId: req.user.branchId
    });
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Table group deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in deleteTableGroup:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// Table Management within Groups

// @desc    Add table to group
// @route   POST /api/settings/table-ordering/:groupId/tables
// @access  Private (Admin/Manager/Staff only)
const addTableToGroup = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can add tables'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const group = await TableGroup.findOne({
      _id: req.params.groupId,
      branchId: req.user.branchId
    });
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }
    
    await group.addTable(req.body);
    await group.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: group,
      message: 'Table added successfully'
    });
    
  } catch (error) {
    console.error('Error in addTableToGroup:', error);
    
    if (error.message === 'Table names must be unique within a group') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Update table in group
// @route   PUT /api/settings/table-ordering/:groupId/tables/:tableId
// @access  Private (Admin/Manager/Staff only)
const updateTableInGroup = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can update tables'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const group = await TableGroup.findOne({
      _id: req.params.groupId,
      branchId: req.user.branchId
    });
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }
    
    await group.updateTable(req.params.tableId, req.body);
    await group.populate('createdBy', 'name email');
    
    res.status(200).json({
      success: true,
      data: group,
      message: 'Table updated successfully'
    });
    
  } catch (error) {
    console.error('Error in updateTableInGroup:', error);
    
    if (error.message === 'Table not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message === 'Table names must be unique within a group') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Remove table from group
// @route   DELETE /api/settings/table-ordering/:groupId/tables/:tableId
// @access  Private (Admin/Manager/Staff only)
const removeTableFromGroup = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can remove tables'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const group = await TableGroup.findOne({
      _id: req.params.groupId,
      branchId: req.user.branchId
    });
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }
    
    const table = group.findTable(req.params.tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    await group.removeTable(req.params.tableId);
    
    res.status(200).json({
      success: true,
      message: 'Table removed successfully'
    });
    
  } catch (error) {
    console.error('Error in removeTableFromGroup:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Generate QR code for table
// @route   POST /api/settings/table-ordering/:groupId/tables/:tableId/qr
// @access  Private (Admin/Manager/Staff only)
const generateTableQR = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can generate QR codes'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const group = await TableGroup.findOne({
      _id: req.params.groupId,
      branchId: req.user.branchId
    });
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Table group not found'
      });
    }
    
    await group.generateTableQR(req.params.tableId);
    const table = group.findTable(req.params.tableId);
    
    res.status(200).json({
      success: true,
      data: {
        tableId: req.params.tableId,
        qrCode: table.qrCode
      },
      message: 'QR code generated successfully'
    });
    
  } catch (error) {
    console.error('Error in generateTableQR:', error);
    
    if (error.message === 'Table not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// Public endpoints for table ordering

// @desc    Get available tables for ordering
// @route   GET /api/settings/table-ordering/available/:branchId
// @access  Public
const getAvailableTables = async (req, res) => {
  try {
    const { branchId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid branch ID'
      });
    }
    
    const availableTables = await TableGroup.getAvailableTables(branchId);
    
    res.status(200).json({
      success: true,
      data: availableTables,
      branchId: branchId
    });
    
  } catch (error) {
    console.error('Error in getAvailableTables:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get table by QR code
// @route   GET /api/settings/table-ordering/qr/:qrCode
// @access  Public
const getTableByQR = async (req, res) => {
  try {
    const { qrCode } = req.params;
    
    const result = await TableGroup.findByQRCode(qrCode);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        group: result.group,
        table: result.table
      }
    });
    
  } catch (error) {
    console.error('Error in getTableByQR:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get table ordering statistics
// @route   GET /api/settings/table-ordering/stats
// @access  Private (Admin/Manager/Staff only)
const getTableOrderingStats = async (req, res) => {
  try {
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && ['admin', 'manager', 'staff'].includes(userRole);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access table ordering statistics'
      });
    }
    
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    const branchId = req.user.branchId;
    
    // Get table ordering statistics
    const stats = await TableGroup.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
      {
        $group: {
          _id: null,
          totalGroups: { $sum: 1 },
          activeGroups: {
            $sum: { $cond: [{ $eq: ['$isEnabled', true] }, 1, 0] }
          },
          totalTables: { $sum: { $size: '$tables' } },
          enabledTables: {
            $sum: {
              $size: {
                $filter: {
                  input: '$tables',
                  cond: { $eq: ['$$this.isEnabled', true] }
                }
              }
            }
          },
          totalCapacity: {
            $sum: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$tables',
                      cond: { $eq: ['$$this.isEnabled', true] }
                    }
                  },
                  as: 'table',
                  in: '$$table.capacity'
                }
              }
            }
          },
          averageServiceCharge: {
            $avg: {
              $avg: {
                $map: {
                  input: '$tables',
                  as: 'table',
                  in: '$$table.serviceCharge'
                }
              }
            }
          }
        }
      }
    ]);
    
    const tableStats = stats.length > 0 ? stats[0] : {
      totalGroups: 0,
      activeGroups: 0,
      totalTables: 0,
      enabledTables: 0,
      totalCapacity: 0,
      averageServiceCharge: 0
    };
    
    // Get groups with table counts
    const groupsWithCounts = await TableGroup.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
      {
        $project: {
          name: 1,
          isEnabled: 1,
          totalTables: { $size: '$tables' },
          enabledTables: {
            $size: {
              $filter: {
                input: '$tables',
                cond: { $eq: ['$$this.isEnabled', true] }
              }
            }
          },
          totalCapacity: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$tables',
                    cond: { $eq: ['$$this.isEnabled', true] }
                  }
                },
                as: 'table',
                in: '$$table.capacity'
              }
            }
          }
        }
      },
      { $sort: { displayOrder: 1, name: 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        ...tableStats,
        groupBreakdown: groupsWithCounts
      },
      branchId: branchId.toString()
    });
    
  } catch (error) {
    console.error('Error in getTableOrderingStats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

module.exports = {
  // Table Groups
  getTableGroups,
  getTableGroup,
  createTableGroup,
  updateTableGroup,
  deleteTableGroup,
  
  // Table Management
  addTableToGroup,
  updateTableInGroup,
  removeTableFromGroup,
  generateTableQR,
  
  // Public
  getAvailableTables,
  getTableByQR,
  
  // Statistics
  getTableOrderingStats
}; 
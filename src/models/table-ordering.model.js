const mongoose = require('mongoose');

// Individual table schema
const tableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Table name is required'],
      trim: true,
      maxlength: [50, 'Table name cannot be more than 50 characters']
    },
    serviceCharge: {
      type: Number,
      default: 0,
      min: [0, 'Service charge cannot be negative']
    },
    minSpend: {
      type: Number,
      default: 0,
      min: [0, 'Minimum spend cannot be negative']
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    qrCode: {
      type: String,
      default: null
    },
    // Additional table properties
    capacity: {
      type: Number,
      default: 4,
      min: [1, 'Table capacity must be at least 1']
    },
    location: {
      type: String,
      default: '',
      maxlength: [100, 'Location cannot be more than 100 characters']
    }
  },
  {
    timestamps: true,
    _id: true
  }
);

// Table group schema
const tableGroupSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [100, 'Group name cannot be more than 100 characters']
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative']
    },
    buttonLabel: {
      type: String,
      required: [true, 'Button label is required'],
      trim: true,
      maxlength: [50, 'Button label cannot be more than 50 characters']
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    tables: [tableSchema],
    // Group-level settings
    defaultServiceCharge: {
      type: Number,
      default: 0,
      min: [0, 'Default service charge cannot be negative']
    },
    defaultMinSpend: {
      type: Number,
      default: 0,
      min: [0, 'Default minimum spend cannot be negative']
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
tableGroupSchema.index({ branchId: 1, displayOrder: 1 });
tableGroupSchema.index({ branchId: 1, isEnabled: 1 });
tableGroupSchema.index({ 'tables._id': 1 });

// Virtual for total tables count
tableGroupSchema.virtual('totalTables').get(function() {
  return this.tables.length;
});

// Virtual for enabled tables count
tableGroupSchema.virtual('enabledTables').get(function() {
  return this.tables.filter(table => table.isEnabled).length;
});

// Virtual for total capacity
tableGroupSchema.virtual('totalCapacity').get(function() {
  return this.tables.reduce((total, table) => total + (table.isEnabled ? table.capacity : 0), 0);
});

// Method to add a table to the group
tableGroupSchema.methods.addTable = function(tableData) {
  // Apply group defaults if not specified
  const newTable = {
    ...tableData,
    serviceCharge: tableData.serviceCharge !== undefined ? tableData.serviceCharge : this.defaultServiceCharge,
    minSpend: tableData.minSpend !== undefined ? tableData.minSpend : this.defaultMinSpend
  };
  
  this.tables.push(newTable);
  return this.save();
};

// Method to update a table in the group
tableGroupSchema.methods.updateTable = function(tableId, updateData) {
  const table = this.tables.id(tableId);
  if (!table) {
    throw new Error('Table not found');
  }
  
  Object.assign(table, updateData);
  return this.save();
};

// Method to remove a table from the group
tableGroupSchema.methods.removeTable = function(tableId) {
  this.tables.pull(tableId);
  return this.save();
};

// Method to find table by ID
tableGroupSchema.methods.findTable = function(tableId) {
  return this.tables.id(tableId);
};

// Method to generate QR code for table
tableGroupSchema.methods.generateTableQR = function(tableId) {
  const table = this.findTable(tableId);
  if (!table) {
    throw new Error('Table not found');
  }
  
  // Generate QR code data (URL to table ordering page)
  const qrData = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/table-order/${this.branchId}/${this._id}/${tableId}`;
  table.qrCode = qrData;
  
  return this.save();
};

// Static method to find table by QR code
tableGroupSchema.statics.findByQRCode = async function(qrCode) {
  const group = await this.findOne({
    'tables.qrCode': qrCode
  }).populate('branchId', 'name address contact');
  
  if (!group) {
    return null;
  }
  
  const table = group.tables.find(t => t.qrCode === qrCode);
  return {
    group,
    table
  };
};

// Static method to get all groups for a branch
tableGroupSchema.statics.getByBranch = async function(branchId, includeDisabled = false) {
  const query = { branchId };
  if (!includeDisabled) {
    query.isEnabled = true;
  }
  
  return await this.find(query)
    .sort({ displayOrder: 1, createdAt: 1 })
    .populate('createdBy', 'name email');
};

// Static method to get available tables for ordering
tableGroupSchema.statics.getAvailableTables = async function(branchId) {
  const groups = await this.find({
    branchId: branchId,
    isEnabled: true
  }).sort({ displayOrder: 1 });
  
  const availableTables = [];
  
  for (const group of groups) {
    const enabledTables = group.tables.filter(table => table.isEnabled);
    if (enabledTables.length > 0) {
      availableTables.push({
        groupId: group._id,
        groupName: group.name,
        buttonLabel: group.buttonLabel,
        tables: enabledTables
      });
    }
  }
  
  return availableTables;
};

// Pre-save middleware to ensure unique table names within group
tableGroupSchema.pre('save', function(next) {
  const tableNames = this.tables.map(table => table.name.toLowerCase());
  const uniqueNames = [...new Set(tableNames)];
  
  if (tableNames.length !== uniqueNames.length) {
    return next(new Error('Table names must be unique within a group'));
  }
  
  next();
});

const TableGroup = mongoose.model('TableGroup', tableGroupSchema);

module.exports = TableGroup; 
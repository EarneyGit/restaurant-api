const mongoose = require('mongoose');

const attributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add an attribute name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    displayOrder: {
      type: Number,
      required: [true, 'Display order is required'],
      min: [0, 'Display order must be at least 0']
    },
    type: {
      type: String,
      enum: ['single', 'multiple'],
      required: [true, 'Attribute type is required'],
      default: 'single'
    },
    requiresSelection: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    availableDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for better performance
attributeSchema.index({ branchId: 1, displayOrder: 1 });
attributeSchema.index({ branchId: 1, isActive: 1 });

const Attribute = mongoose.model('Attribute', attributeSchema);

module.exports = Attribute; 
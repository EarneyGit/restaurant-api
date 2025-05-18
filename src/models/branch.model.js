const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a branch name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    code: {
      type: String,
      required: [true, 'Please add a branch code'],
      trim: true,
      unique: true,
      maxlength: [10, 'Code cannot be more than 10 characters']
    },
    address: {
      street: {
        type: String,
        required: [true, 'Please add a street address']
      },
      city: {
        type: String,
        required: [true, 'Please add a city']
      },
      state: {
        type: String,
        required: [true, 'Please add a state/province']
      },
      postalCode: {
        type: String,
        required: [true, 'Please add a postal code']
      },
      country: {
        type: String,
        required: [true, 'Please add a country'],
        default: 'United States'
      }
    },
    contact: {
      phone: {
        type: String,
        required: [true, 'Please add a phone number']
      },
      email: {
        type: String,
        required: [true, 'Please add an email']
      }
    },
    location: {
      // GeoJSON Point
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        index: '2dsphere'
      },
      formattedAddress: String
    },
    openingHours: [
      {
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          required: true
        },
        isOpen: {
          type: Boolean,
          default: true
        },
        openTime: {
          type: String,
          required: function() {
            return this.isOpen;
          },
          validate: {
            validator: function(v) {
              // Validate time format (HH:MM)
              return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: 'Open time must be in HH:MM format'
          }
        },
        closeTime: {
          type: String,
          required: function() {
            return this.isOpen;
          },
          validate: {
            validator: function(v) {
              // Validate time format (HH:MM)
              return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: 'Close time must be in HH:MM format'
          }
        }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    capacity: {
      type: Number,
      default: 50
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    image: {
      type: String,
      default: 'default-branch.jpg'
    },
    slug: {
      type: String,
      unique: true
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Branch settings for ordering methods
    isCollectionEnabled: {
      type: Boolean,
      default: true
    },
    isDeliveryEnabled: {
      type: Boolean,
      default: true
    },
    isTableOrderingEnabled: {
      type: Boolean,
      default: true
    },
    facilities: [{
      type: String,
      enum: ['wifi', 'parking', 'delivery', 'takeaway', 'outdoor', 'accessible']
    }],
    maxCapacity: {
      type: Number,
      min: [1, 'Capacity must be at least 1']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create slug from the name
branchSchema.pre('save', function(next) {
  this.slug = slugify(this.name);
  next();
});

// Validate default branch constraint
branchSchema.pre('save', async function(next) {
  try {
    // Only run if isDefault is modified and being set to true
    if (this.isModified('isDefault') && this.isDefault) {
      const Branch = this.constructor;
      
      // Find any existing default branch that's not this one
      const existingDefault = await Branch.findOne({ 
        _id: { $ne: this._id },
        isDefault: true 
      });
      
      if (existingDefault) {
        throw new Error('There can only be one default branch. Please unset the current default branch first.');
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Create virtual for staff assigned to this branch
branchSchema.virtual('staff', {
  ref: 'User',
  localField: '_id',
  foreignField: 'branchId',
  justOne: false
});

// Create virtual for products in this branch
branchSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'branchId',
  justOne: false
});

// Create virtual for categories in this branch
branchSchema.virtual('categories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'branchId',
  justOne: false
});

// Create virtual for orders from this branch
branchSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'branchId',
  justOne: false
});

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch; 
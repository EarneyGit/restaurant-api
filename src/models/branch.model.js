const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a branch name'],
      trim: true,
      unique: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    slug: {
      type: String,
      unique: true
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
      state: String,
      postalCode: {
        type: String,
        required: [true, 'Please add a postal code']
      },
      country: {
        type: String,
        required: [true, 'Please add a country']
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
    phone: {
      type: String,
      required: [true, 'Please add a phone number']
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email'
      ]
    },
    openingHours: [{
      day: {
        type: String,
        required: true,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      isOpen: {
        type: Boolean,
        default: true
      },
      openTime: String,
      closeTime: String
    }],
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    image: {
      type: String,
      default: 'default-branch.jpg'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    facilities: [{
      type: String,
      enum: ['wifi', 'parking', 'delivery', 'takeaway', 'outdoor', 'accessible']
    }],
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    maxCapacity: {
      type: Number,
      min: [1, 'Capacity must be at least 1']
    }
  },
  {
    timestamps: true
  }
);

// Create slug from the name
branchSchema.pre('save', function(next) {
  this.slug = slugify(this.name);
  next();
});

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch; 
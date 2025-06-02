const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const { deleteFile } = require('../utils/fileUpload');

// Define the availability schema
const availabilitySchema = new mongoose.Schema({
  Monday: {
    type: {
      type: String,
      enum: ['All Day', 'Specific Times', 'Not Available'],
      default: 'All Day'
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    }
  },
  Tuesday: {
    type: {
      type: String,
      enum: ['All Day', 'Specific Times', 'Not Available'],
      default: 'All Day'
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    }
  },
  Wednesday: {
    type: {
      type: String,
      enum: ['All Day', 'Specific Times', 'Not Available'],
      default: 'All Day'
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    }
  },
  Thursday: {
    type: {
      type: String,
      enum: ['All Day', 'Specific Times', 'Not Available'],
      default: 'All Day'
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    }
  },
  Friday: {
    type: {
      type: String,
      enum: ['All Day', 'Specific Times', 'Not Available'],
      default: 'All Day'
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    }
  },
  Saturday: {
    type: {
      type: String,
      enum: ['All Day', 'Specific Times', 'Not Available'],
      default: 'All Day'
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    }
  },
  Sunday: {
    type: {
      type: String,
      enum: ['All Day', 'Specific Times', 'Not Available'],
      default: 'All Day'
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    }
  }
}, { _id: false });

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a category name'],
      trim: true,
      unique: true,
      maxlength: [50, 'Name cannot be more than 50 characters']
    },
    slug: {
      type: String,
      unique: true
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    hidden: {
      type: Boolean,
      default: false
    },
    includeAttributes: {
      type: Boolean,
      default: false
    },
    includeDiscounts: {
      type: Boolean,
      default: false
    },
    imageUrl: {
      type: String
    },
    availability: {
      type: availabilitySchema,
      default: () => ({
        Monday: { type: 'All Day', startTime: null, endTime: null },
        Tuesday: { type: 'All Day', startTime: null, endTime: null },
        Wednesday: { type: 'All Day', startTime: null, endTime: null },
        Thursday: { type: 'All Day', startTime: null, endTime: null },
        Friday: { type: 'All Day', startTime: null, endTime: null },
        Saturday: { type: 'All Day', startTime: null, endTime: null },
        Sunday: { type: 'All Day', startTime: null, endTime: null }
      })
    },
    printers: [{
      type: String,
      enum: ['Admin user (P1)', 'Kitchen (P2)', 'Bar (P3)']
    }],
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Please select a branch']
    },
    // Audit Log Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create virtual for products in this category
categorySchema.virtual('items', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  justOne: false,
  match: function() {
    return { branchId: this.branchId };
  }
});

// Create slug from the name
categorySchema.pre('save', function(next) {
  this.slug = slugify(this.name);
  next();
});

// Delete old image when updating
categorySchema.pre('save', async function(next) {
  if (this.isModified('imageUrl') && this._oldImageUrl) {
    await deleteFile(this._oldImageUrl);
  }
  next();
});

// Store old image URL before update
categorySchema.pre('findOneAndUpdate', async function(next) {
  const docToUpdate = await this.model.findOne(this.getQuery());
  if (docToUpdate && this._update.imageUrl && docToUpdate.imageUrl !== this._update.imageUrl) {
    await deleteFile(docToUpdate.imageUrl);
  }
  next();
});

// Delete image when removing category
categorySchema.pre('remove', async function(next) {
  if (this.imageUrl) {
    await deleteFile(this.imageUrl);
  }
  next();
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category; 
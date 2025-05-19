const mongoose = require('mongoose');
const slugify = require('../utils/slugify');
const { deleteFile } = require('../utils/fileUpload');

// Define the availability schema
const availabilitySchema = new mongoose.Schema({
  Monday: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
  },
  Tuesday: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
  },
  Wednesday: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
  },
  Thursday: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
  },
  Friday: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
  },
  Saturday: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
  },
  Sunday: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
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
    imageUrl: {
      type: String
    },
    availability: {
      type: availabilitySchema,
      default: () => ({
        Monday: 'All Day',
        Tuesday: 'All Day',
        Wednesday: 'All Day',
        Thursday: 'All Day',
        Friday: 'All Day',
        Saturday: 'All Day',
        Sunday: 'All Day'
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
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a product name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot be more than 1000 characters']
    },
    price: {
      type: Number,
      required: [true, 'Please add a price'],
      min: [0, 'Price must be at least 0']
    },
    hideItem: {
      type: Boolean,
      default: false
    },
    delivery: {
      type: Boolean,
      default: true
    },
    collection: {
      type: Boolean,
      default: true
    },
    dineIn: {
      type: Boolean,
      default: true
    },
    weight: {
      type: Number
    },
    calorificValue: {
      type: String
    },
    calorieDetails: {
      type: String
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please select a category']
    },
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

// Create virtual for calculating discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.discountedPrice && this.price > this.discountedPrice) {
    return Math.round((this.price - this.discountedPrice) / this.price * 100);
  }
  return 0;
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product; 
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
      required: [true, 'Please add a description'],
      maxlength: [1000, 'Description cannot be more than 1000 characters']
    },
    price: {
      type: Number,
      required: [true, 'Please add a price'],
      min: [0, 'Price must be at least 0']
    },
    discountedPrice: {
      type: Number,
      default: 0
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please select a category']
    },
    image: {
      type: String,
      default: 'default-product.jpg'
    },
    images: [{
      type: String
    }],
    isAvailable: {
      type: Boolean,
      default: true
    },
    isPopular: {
      type: Boolean,
      default: false
    },
    isRecommended: {
      type: Boolean,
      default: false
    },
    preparationTime: {
      type: Number,
      default: 15,  // minutes
      min: [1, 'Preparation time must be at least 1 minute']
    },
    ingredients: [String],
    nutritionalInfo: {
      calories: Number,
      fat: Number,
      carbs: Number,
      protein: Number,
      allergens: [String]
    },
    tags: [String],
    variants: [{
      name: String,
      price: Number,
      isDefault: Boolean
    }],
    addons: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Addon'
    }]
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
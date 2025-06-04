const mongoose = require('mongoose');

const productAttributeItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required']
    },
    attributeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attribute',
      required: [true, 'Attribute is required']
    },
    name: {
      type: String,
      required: [true, 'Please add an attribute item name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be at least 0'],
      default: 0
    },
    displayOrder: {
      type: Number,
      required: [true, 'Display order is required'],
      min: [0, 'Display order must be at least 0'],
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    hiddenForToday: {
      type: Boolean,
      default: false
    },
    fullyHidden: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    image: {
      type: String
    },
    // Stock management for attribute items
    stockManagement: {
      isManaged: {
        type: Boolean,
        default: false
      },
      quantity: {
        type: Number,
        default: 0,
        min: [0, 'Stock quantity cannot be negative']
      },
      lowStockThreshold: {
        type: Number,
        default: 5
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },
    // Availability settings
    availability: {
      monday: { type: Boolean, default: true },
      tuesday: { type: Boolean, default: true },
      wednesday: { type: Boolean, default: true },
      thursday: { type: Boolean, default: true },
      friday: { type: Boolean, default: true },
      saturday: { type: Boolean, default: true },
      sunday: { type: Boolean, default: true }
    },
    // Additional metadata
    allergens: {
      contains: [{
        type: String,
        enum: ['celery', 'crustaceans', 'eggs', 'fish', 'gluten', 'lupin', 'milk', 'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame', 'soya', 'sulphites']
      }],
      mayContain: [{
        type: String,
        enum: ['celery', 'crustaceans', 'eggs', 'fish', 'gluten', 'lupin', 'milk', 'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame', 'soya', 'sulphites']
      }]
    },
    calorificValue: {
      type: Number
    },
    weight: {
      type: String
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

// Compound indexes for better performance
productAttributeItemSchema.index({ productId: 1, attributeId: 1 });
productAttributeItemSchema.index({ productId: 1, isActive: 1 });
productAttributeItemSchema.index({ attributeId: 1, isActive: 1 });
productAttributeItemSchema.index({ productId: 1, attributeId: 1, displayOrder: 1 });

// Ensure unique combination of product, attribute, and name
productAttributeItemSchema.index({ 
  productId: 1, 
  attributeId: 1, 
  name: 1 
}, { unique: true });

const ProductAttributeItem = mongoose.model('ProductAttributeItem', productAttributeItemSchema);

module.exports = ProductAttributeItem; 
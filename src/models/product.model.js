const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  start: {
    type: String,
    required: true
  },
  end: {
    type: String,
    required: true
  }
}, { _id: false });

const dayAvailabilitySchema = new mongoose.Schema({
  isAvailable: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    enum: ['All Day', 'Specific Times', 'Not Available'],
    default: 'All Day'
  },
  times: [timeSlotSchema]
}, { _id: false });

const itemSettingsSchema = new mongoose.Schema({
  showSelectedOnly: {
    type: Boolean,
    default: false
  },
  showSelectedCategories: {
    type: Boolean,
    default: false
  },
  limitSingleChoice: {
    type: Boolean,
    default: false
  },
  addAttributeCharges: {
    type: Boolean,
    default: false
  },
  useProductPrices: {
    type: Boolean,
    default: false
  },
  showChoiceAsDropdown: {
    type: Boolean,
    default: false
  }
}, { _id: false });

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
    // Caching fields for better performance
    // currentEffectivePrice: {
    //   type: Number,
    //   default: function() { return this.price; }
    // },
    // hasActivePriceChanges: {
    //   type: Boolean,
    //   default: false
    // },
    // activePriceChangeId: {
    //   type: String
    // },
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
    },
    images: [{
      type: String
    }],
    availability: {
      monday: dayAvailabilitySchema,
      tuesday: dayAvailabilitySchema,
      wednesday: dayAvailabilitySchema,
      thursday: dayAvailabilitySchema,
      friday: dayAvailabilitySchema,
      saturday: dayAvailabilitySchema,
      sunday: dayAvailabilitySchema
    },
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
    selectedItems: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    itemSettings: {
      type: itemSettingsSchema,
      default: () => ({})
    },
    tillProviderProductId: {
      type: String,
      trim: true
    },
    cssClass: {
      type: String,
      trim: true
    },
    freeDelivery: {
      type: Boolean,
      default: false
    },
    collectionOnly: {
      type: Boolean,
      default: false
    },
    deleted: {
      type: Boolean,
      default: false
    },
    hidePrice: {
      type: Boolean,
      default: false
    },
    allowAddWithoutChoices: {
      type: Boolean,
      default: false
    },
    // Price Changes
    // priceChanges: [{
    //   id: {
    //     type: String,
    //     required: true
    //   },
    //   name: {
    //     type: String,
    //     default: ''
    //   },
    //   type: {
    //     type: String,
    //     enum: ['increase', 'decrease', 'fixed'],
    //     required: true
    //   },
    //   value: {
    //     type: Number,
    //     required: true
    //   },
    //   startDate: {
    //     type: String,
    //     required: true
    //   },
    //   endDate: {
    //     type: String,
    //     required: true
    //   },
    //   daysOfWeek: [{
    //     type: String,
    //     enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    //   }],
    //   timeStart: String,
    //   timeEnd: String,
    //   active: {
    //     type: Boolean,
    //     default: true
    //   }
    // }],
    // Stock Management fields
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
        default: 10
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
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

// Create virtual for calculating discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.discountedPrice && this.price > this.discountedPrice) {
    return Math.round((this.price - this.discountedPrice) / this.price * 100);
  }
  return 0;
});

productSchema.virtual('priceChanges', {
  ref: 'PriceChange',
  localField: '_id',
  foreignField: 'productId',
  justOne: false
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product; 
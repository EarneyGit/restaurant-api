const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      // required: true,
      unique: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Allow guest orders without user
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: [true, 'Product is required']
        },
        quantity: {
          type: Number,
          required: [true, 'Quantity is required'],
          min: [1, 'Quantity must be at least 1']
        },
        price: {
          type: Number,
          required: [true, 'Price is required']
        },
        notes: String,
        // Attribute selections for this product
        selectedAttributes: [{
          attributeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attribute',
            required: true
          },
          attributeName: {
            type: String,
            required: true
          },
          attributeType: {
            type: String,
            enum: ['single', 'multiple', 'multiple-times'],
            required: true
          },
          selectedItems: [{
            itemId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'ProductAttributeItem',
              required: true
            },
            itemName: {
              type: String,
              required: true
            },
            itemPrice: {
              type: Number,
              required: true,
              default: 0
            },
            quantity: {
              type: Number,
              required: true,
              default: 1,
              min: [1, 'Attribute item quantity must be at least 1']
            }
          }]
        }]
      }
    ],
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required']
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'cancelled'],
      default: 'pending'
    },
    totalAmount: {
      type: Number,
      required: true
    },
    // Discount information
    discount: {
      discountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Discount'
      },
      code: String,
      name: String,
      discountType: {
        type: String,
        enum: ['percentage', 'fixed']
      },
      discountValue: Number,
      discountAmount: {
        type: Number,
        default: 0
      },
      originalTotal: Number
    },
    // Discount applied field for easier querying
    discountApplied: {
      discountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Discount'
      },
      code: String,
      name: String,
      discountType: {
        type: String,
        enum: ['percentage', 'fixed']
      },
      discountValue: Number,
      discountAmount: {
        type: Number,
        default: 0
      },
      originalTotal: Number,
      appliedAt: {
        type: Date,
        default: Date.now
      }
    },
    // Final total after discount
    finalTotal: {
      type: Number,
      default: function() {
        return this.totalAmount - (this.discount?.discountAmount || 0);
      }
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'online', 'cash_on_delivery'],
      default: 'cash'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'processing', 'failed'],
      default: 'pending'
    },
    // Stripe payment fields
    stripePaymentIntentId: {
      type: String,
      default: null
    },
    stripeClientSecret: {
      type: String,
      default: null
    },
    stripePaymentMethod: {
      type: String,
      default: null
    },
    stripePaymentDate: {
      type: Date,
      default: null
    },
    deliveryMethod: {
      type: String,
      enum: ['collection', 'delivery'],
      default: 'collection'
    },
    // Order type (same as deliveryMethod but using frontend naming)
    orderType: {
      type: String,
      enum: ['collection', 'delivery'],
      default: function() {
        // Map deliveryMethod to orderType
        const methodToType = {
          'collection': 'collection',
          'delivery': 'delivery',
        };
        return methodToType[this.deliveryMethod] || 'collection';
      }
    },
    // Tips
    tips: {
      type: Number,
      default: 0,
      min: [0, 'Tips cannot be negative']
    },
    // Delivery fee
    deliveryFee: {
      type: Number,
      default: 0,
      min: [0, 'Delivery fee cannot be negative']
    },
    // Service charge (legacy field)
    serviceCharge: {
      type: Number,
      default: 0,
      min: [0, 'Service charge cannot be negative']
    },
    // Detailed service charges
    serviceCharges: {
      totalMandatory: {
        type: Number,
        default: 0,
        min: [0, 'Mandatory service charges cannot be negative']
      },
      totalOptional: {
        type: Number,
        default: 0,
        min: [0, 'Optional service charges cannot be negative']
      },
      totalAll: {
        type: Number,
        default: 0,
        min: [0, 'Total service charges cannot be negative']
      },
      breakdown: [{
        id: {
          type: String,
          required: true
        },
        name: {
          type: String,
          required: true
        },
        type: {
          type: String,
          required: true
        },
        value: {
          type: Number,
          required: true
        },
        amount: {
          type: Number,
          required: true
        },
        optional: {
          type: Boolean,
          default: false
        },
        accepted: {
          type: Boolean,
          default: false
        }
      }]
    },
    // Subtotal (before tax, discounts, etc)
    subtotal: {
      type: Number,
      default: 0,
      min: [0, 'Subtotal cannot be negative']
    },
    // Tax amount
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    // Total amount (deprecated, use finalTotal instead)
    total: {
      type: Number,
      default: function() {
        return this.finalTotal || this.totalAmount;
      }
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      zipCode: String, // Alias for postalCode
      country: String,
      notes: String,
      latitude: Number,
      longitude: Number
    },
    // Customer ID reference (in addition to user field)
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: function() {
        return this.user;
      }
    },
    estimatedDeliveryTime: Date,
    estimatedTimeToComplete: {
      type: Number,
      default: 45,
      min: [0, 'Estimated time to complete cannot be negative']
    },
    isGuestOrder: {
      type: Boolean,
      default: false
    },
    orderCustomerDetails: {
      firstName: String,
      lastName: String,
      phone: String,
      email: String,
      address: String,
      latitude: Number,
      longitude: Number
    },
    actualDeliveryTime: Date,
    selectedTimeSlot: String,
    customerNotes: String,
    internalNotes: String,
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

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  try {
    // Only generate orderNumber for new records
    if (!this.orderNumber) {
      // Get the branch code or use a default
      let branchCode = 'BR';
      
      if (this.branchId) {
        const Branch = mongoose.model('Branch');
        const branch = await Branch.findById(this.branchId);
        if (branch && branch.code) {
          branchCode = branch.code;
        }
      }
      
      // Generate today's date in YYMMDD format
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      
      // Find the last order for today to increment the counter
      const Order = this.constructor;
      const orderNumberPrefix = `${branchCode}-${dateStr}`;
      const lastOrder = await Order.findOne(
        { orderNumber: new RegExp(`^${orderNumberPrefix}`) },
        { orderNumber: 1 }
      ).sort({ orderNumber: -1 });
      
      let counter = 1;
      if (lastOrder && lastOrder.orderNumber) {
        // Extract the counter from the last order number
        const lastCounter = parseInt(lastOrder.orderNumber.split('-')[2], 10);
        if (!isNaN(lastCounter)) {
          counter = lastCounter + 1;
        }
      }
      
      // Create the new order number with padded counter
      this.orderNumber = `${orderNumberPrefix}-${String(counter).padStart(4, '0')}`;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Calculate total amount before saving (including attribute prices)
orderSchema.pre('save', function(next) {
  if (this.products && this.products.length > 0) {
    // Calculate subtotal from products
    this.subtotal = this.products.reduce((total, item) => {
      let itemTotal = item.price * item.quantity;
      
      // Add attribute item prices
      if (item.selectedAttributes && item.selectedAttributes.length > 0) {
        const attributeTotal = item.selectedAttributes.reduce((attrTotal, attr) => {
          if (attr.selectedItems && attr.selectedItems.length > 0) {
            const attrItemTotal = attr.selectedItems.reduce((itemSum, selectedItem) => {
              return itemSum + (selectedItem.itemPrice * selectedItem.quantity);
            }, 0);
            return attrTotal + attrItemTotal;
          }
          return attrTotal;
        }, 0);
        
        // Multiply attribute total by product quantity
        itemTotal += (attributeTotal * item.quantity);
      }
      
      return total + itemTotal;
    }, 0);
    
    // Calculate totalAmount including all charges
    this.totalAmount = this.subtotal + (this.tax || 0) + (this.deliveryFee || 0) + (this.serviceCharge || 0) + (this.tips || 0);
    
    // Update finalTotal
    this.finalTotal = this.totalAmount - (this.discount?.discountAmount || this.discountApplied?.discountAmount || 0);
    
    // Update total field for backward compatibility
    this.total = this.finalTotal;
  }
  
  // Sync customerId with user field
  if (this.user && !this.customerId) {
    this.customerId = this.user;
  }
  
  // Sync orderType with deliveryMethod
  if (this.deliveryMethod && !this.orderType) {
    const methodToType = {
      'pickup': 'collection',
      'delivery': 'delivery',
      'dine_in': 'dine-in'
    };
    this.orderType = methodToType[this.deliveryMethod] || 'collection';
  }
  
  // Sync zipCode with postalCode
  if (this.deliveryAddress) {
    if (this.deliveryAddress.postalCode && !this.deliveryAddress.zipCode) {
      this.deliveryAddress.zipCode = this.deliveryAddress.postalCode;
    } else if (this.deliveryAddress.zipCode && !this.deliveryAddress.postalCode) {
      this.deliveryAddress.postalCode = this.deliveryAddress.zipCode;
    }
  }
  
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 
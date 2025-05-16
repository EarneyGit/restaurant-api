const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        name: String,
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity can not be less than 1']
        },
        price: {
          type: Number,
          required: true
        },
        variant: {
          name: String,
          price: Number
        },
        addons: [
          {
            name: String,
            price: Number
          }
        ],
        notes: String
      }
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount must be at least 0']
    },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'online'],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    deliveryMethod: {
      type: String,
      enum: ['pickup', 'dine-in', 'delivery'],
      required: true
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },
    deliveryFee: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    notes: String,
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch'
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    estimatedDeliveryTime: Date
  },
  {
    timestamps: true
  }
);

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  // Only generate number for new orders
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    
    // Get count of orders today and increment
    const Order = this.constructor;
    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const todayEnd = new Date(date.setHours(23, 59, 59, 999));
    
    const orderCount = await Order.countDocuments({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });
    
    // Format: YY-MM-DD-XXXX (where XXXX is the sequential number)
    const sequentialNumber = ('000' + (orderCount + 1)).slice(-4);
    this.orderNumber = `${year}${month}${day}${sequentialNumber}`;
  }
  
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 
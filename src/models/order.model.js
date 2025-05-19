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
      required: [true, 'User is required']
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
        notes: String
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
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'online'],
      default: 'cash'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending'
    },
    deliveryMethod: {
      type: String,
      enum: ['pickup', 'delivery', 'dine_in'],
      default: 'pickup'
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      notes: String
    },
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    customerNotes: String,
    internalNotes: String
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

// Calculate total amount before saving
orderSchema.pre('save', function(next) {
  if (this.products && this.products.length > 0) {
    this.totalAmount = this.products.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 
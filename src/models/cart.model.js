const mongoose = require('mongoose');

// Schema for selected options (customizations like size, toppings, etc.)
const selectedOptionsSchema = new mongoose.Schema({
  optionId: {
    type: String,
    required: true
  },
  choiceId: {
    type: String,
    required: true
  }
}, { _id: false });

// Schema for individual cart items
const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be a whole number'
    }
  },
  selectedOptions: {
    type: Map,
    of: String,
    default: new Map()
  },
  specialRequirements: {
    type: String,
    maxlength: [500, 'Special requirements cannot exceed 500 characters'],
    trim: true
  },
  // Store the price at the time of adding to cart (for price consistency)
  priceAtTime: {
    type: Number,
    required: [true, 'Price at time of adding is required'],
    min: [0, 'Price cannot be negative']
  },
  // Calculated fields
  itemTotal: {
    type: Number,
    required: true,
    min: [0, 'Item total cannot be negative']
  }
}, { 
  timestamps: true,
  _id: true
});

// Main cart schema
const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  sessionId: {
    type: String,
    trim: true,
    // For guest users who haven't signed up yet
    index: true
  },
  items: [cartItemSchema],
  
  // Cart totals
  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: [0, 'Delivery fee cannot be negative']
  },
  total: {
    type: Number,
    default: 0,
    min: [0, 'Total cannot be negative']
  },
  
  // Cart metadata
  status: {
    type: String,
    enum: ['active', 'checkout', 'abandoned', 'converted'],
    default: 'active'
  },
  expiresAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // 30 days in seconds
  },
  
  // For delivery/order context
  orderType: {
    type: String,
    enum: ['delivery', 'pickup', 'dine-in'],
    default: 'delivery'
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
cartSchema.index({ userId: 1, status: 1 });
cartSchema.index({ sessionId: 1, status: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for cart item count
cartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((total, item) => {
    item.itemTotal = item.priceAtTime * item.quantity;
    return total + item.itemTotal;
  }, 0);
  
  // Set default delivery fee if not set
  if (this.deliveryFee === undefined) {
    this.deliveryFee = this.orderType === 'delivery' ? 5.00 : 0;
  }
  
  // Calculate total
  this.total = this.subtotal + this.deliveryFee;
  
  // Update expiration
  this.expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
  
  next();
});

// Static method to find or create cart for user
cartSchema.statics.findOrCreateCart = async function(userId, sessionId = null, branchId = null) {
  let cart = await this.findOne({ 
    $or: [
      { userId: userId, status: 'active' },
      ...(sessionId ? [{ sessionId: sessionId, status: 'active' }] : [])
    ]
  }).populate('items.productId', 'name price images category');
  
  if (!cart) {
    cart = new this({
      userId,
      sessionId,
      branchId,
      items: [],
      status: 'active'
    });
    await cart.save();
  }
  
  return cart;
};

// Method to add item to cart
cartSchema.methods.addItem = async function(productId, quantity, selectedOptions = {}, specialRequirements = '', priceAtTime) {
  // Check if item with same product and options already exists
  const existingItemIndex = this.items.findIndex(item => 
    item.productId.toString() === productId.toString() && 
    this._compareOptions(item.selectedOptions, selectedOptions)
  );
  
  if (existingItemIndex >= 0) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].specialRequirements = specialRequirements; // Update special requirements
  } else {
    // Add new item
    this.items.push({
      productId,
      quantity,
      selectedOptions: new Map(Object.entries(selectedOptions)),
      specialRequirements,
      priceAtTime
    });
  }
  
  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = async function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Cart item not found');
  }
  
  if (quantity <= 0) {
    this.items.pull(itemId);
  } else {
    item.quantity = quantity;
  }
  
  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(itemId) {
  this.items.pull(itemId);
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  return this.save();
};

// Helper method to compare selected options
cartSchema.methods._compareOptions = function(options1, options2) {
  const map1 = options1 instanceof Map ? options1 : new Map(Object.entries(options1 || {}));
  const map2 = options2 instanceof Map ? options2 : new Map(Object.entries(options2 || {}));
  
  if (map1.size !== map2.size) return false;
  
  for (let [key, value] of map1) {
    if (map2.get(key) !== value) return false;
  }
  
  return true;
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart; 
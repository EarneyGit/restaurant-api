const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');

// Helper function to transform cart data for frontend
const transformCartForResponse = (cart) => {
  if (!cart) return null;
  
  return {
    id: cart._id,
    userId: cart.userId,
    sessionId: cart.sessionId,
    items: cart.items.map(item => {
      // Calculate attribute prices
      const attributePrices = item.selectedAttributes ? item.selectedAttributes.reduce((total, attr) => {
        const attrTotal = attr.selectedItems.reduce((sum, selectedItem) => {
          return sum + (selectedItem.itemPrice * selectedItem.quantity);
        }, 0);
        return total + attrTotal;
      }, 0) : 0;

      // Get the current effective price from the product
      const currentEffectivePrice = item.productId.currentEffectivePrice || item.productId.price;

      // Calculate total price per item including attributes
      const totalPricePerItem = currentEffectivePrice + attributePrices;

      return {
        id: item._id,
        productId: item.productId._id || item.productId,
        name: item.productId.name || 'Unknown Product',
        description: item.productId.description || '',
        price: {
          base: item.priceAtTime,
          currentEffectivePrice: currentEffectivePrice,
          attributes: attributePrices,
          total: totalPricePerItem
        },
        hasActivePriceChanges: item.productId.hasActivePriceChanges || false,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions ? Object.fromEntries(item.selectedOptions) : {},
        specialRequirements: item.specialRequirements || '',
        images: item.productId.images || [],
        itemTotal: item.itemTotal,
        category: item.productId.category || null,
        selectedAttributes: item.selectedAttributes ? item.selectedAttributes.map(attr => ({
          attributeId: attr.attributeId,
          attributeName: attr.attributeName,
          attributeType: attr.attributeType,
          selectedItems: attr.selectedItems.map(item => ({
            itemId: item.itemId,
            itemName: item.itemName,
            itemPrice: item.itemPrice,
            quantity: item.quantity
          }))
        })) : []
      };
    }),
    subtotal: cart.subtotal,
    deliveryFee: cart.deliveryFee,
    total: cart.total,
    itemCount: cart.itemCount,
    orderType: cart.orderType,
    branchId: cart.branchId,
    status: cart.status,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt
  };
};

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private/Public (supports both authenticated users and session-based)
exports.getCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const branchId = req.query.branchId;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or session ID required'
      });
    }
    
    let query = { status: 'active' };
    if (userId) {
      query.userId = userId;
    } else {
      query.sessionId = sessionId;
    }

    // Add branchId to query if provided
    if (branchId) {
      query.branchId = branchId;
    }
    
    const cart = await Cart.findOne(query)
      .populate('items.productId', 'name price currentEffectivePrice hasActivePriceChanges images category description allergens')
      .populate('branchId', 'name address');
    
    if (!cart) {
      // Return empty cart structure instead of 404
      return res.status(200).json({
        success: true,
        data: {
          id: null,
          userId: userId || null,
          sessionId: sessionId || null,
          items: [],
          subtotal: 0,
          deliveryFee: 0,
          total: 0,
          itemCount: 0,
          orderType: 'delivery',
          branchId: branchId || null,
          status: 'active'
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: transformCartForResponse(cart)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private/Public
exports.addToCart = async (req, res, next) => {
  try {
    const { 
      productId, 
      quantity = 1, 
      selectedOptions = {}, 
      specialRequirements = '', 
      branchId,
      selectedAttributes = []
    } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or session ID required'
      });
    }
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Process attributes and get their details
    const Attribute = require('../models/attribute.model');
    const ProductAttributeItem = require('../models/product-attribute-item.model');
    
    const processedAttributes = [];
    
    for (const attr of selectedAttributes) {
      // Validate attribute exists
      const attribute = await Attribute.findById(attr.attributeId);
      if (!attribute) {
        return res.status(400).json({
          success: false,
          message: `Attribute not found: ${attr.attributeId}`
        });
      }

      const processedItems = [];
      
      // Validate and process each selected item
      for (const selectedItem of attr.selectedItems) {
        const attributeItem = await ProductAttributeItem.findOne({
          _id: selectedItem.itemId,
          productId: productId,
          attributeId: attr.attributeId
        });
        
        if (!attributeItem) {
          return res.status(400).json({
            success: false,
            message: `Attribute item not found or not available for this product: ${selectedItem.itemId}`
          });
        }
        
        processedItems.push({
          itemId: attributeItem._id,
          itemName: attributeItem.name,
          itemPrice: attributeItem.price,
          quantity: selectedItem.quantity
        });
      }

      processedAttributes.push({
        attributeId: attribute._id,
        attributeName: attribute.name,
        attributeType: attribute.type,
        selectedItems: processedItems
      });
    }
    
    // Find or create cart
    let cart = await Cart.findOrCreateCart(userId, sessionId, branchId);
    
    // Add item to cart with processed attributes
    await cart.addItem(
      productId,
      quantity,
      selectedOptions,
      specialRequirements,
      product.price,
      processedAttributes
    );
    
    // Populate cart items for response
    await cart.populate('items.productId', 'name price currentEffectivePrice hasActivePriceChanges images category description allergens');
    
    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: transformCartForResponse(cart)
    });
  } catch (error) {
    console.error('Error in addToCart:', error);
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private/Public
exports.updateCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity, specialRequirements, branchId } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or session ID required'
      });
    }
    
    if (quantity !== undefined && quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative'
      });
    }
    
    // Find cart
    let query = { status: 'active' };
    if (userId) {
      query.userId = userId;
    } else {
      query.sessionId = sessionId;
    }

    // Add branchId to query if provided
    if (branchId) {
      query.branchId = branchId;
    }
    
    const cart = await Cart.findOne(query);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Find the cart item
    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }
    
    // Update quantity if provided
    if (quantity !== undefined) {
      if (quantity === 0) {
        cart.items.pull(itemId);
      } else {
        cartItem.quantity = quantity;
      }
    }
    
    // Update special requirements if provided
    if (specialRequirements !== undefined) {
      cartItem.specialRequirements = specialRequirements;
    }
    
    await cart.save();
    
    // Populate cart items for response
    await cart.populate('items.productId', 'name price currentEffectivePrice hasActivePriceChanges images category description allergens');
    
    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      data: transformCartForResponse(cart)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private/Public
exports.removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const branchId = req.query.branchId || req.body.branchId;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or session ID required'
      });
    }
    
    // Find cart
    let query = { status: 'active' };
    if (userId) {
      query.userId = userId;
    } else {
      query.sessionId = sessionId;
    }

    // Add branchId to query if provided
    if (branchId) {
      query.branchId = branchId;
    }
    
    const cart = await Cart.findOne(query);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Remove item
    await cart.removeItem(itemId);
    
    // Populate cart items for response
    await cart.populate('items.productId', 'name price currentEffectivePrice hasActivePriceChanges images category description allergens');
    
    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: transformCartForResponse(cart)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private/Public
exports.clearCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or session ID required'
      });
    }
    
    // Find cart
    let query = { status: 'active' };
    if (userId) {
      query.userId = userId;
    } else {
      query.sessionId = sessionId;
    }
    
    const cart = await Cart.findOne(query);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Clear cart
    await cart.clearCart();
    
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: transformCartForResponse(cart)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart delivery settings
// @route   PUT /api/cart/delivery
// @access  Private/Public
exports.updateCartDelivery = async (req, res, next) => {
  try {
    const { orderType, branchId, deliveryFee } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or session ID required'
      });
    }
    
    if (orderType && !['delivery', 'pickup', 'dine-in'].includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order type. Must be delivery, pickup, or dine-in'
      });
    }
    
    // Find cart
    let query = { status: 'active' };
    if (userId) {
      query.userId = userId;
    } else {
      query.sessionId = sessionId;
    }
    
    const cart = await Cart.findOne(query);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Update delivery settings
    if (orderType) cart.orderType = orderType;
    if (branchId) cart.branchId = branchId;
    if (deliveryFee !== undefined) cart.deliveryFee = deliveryFee;
    
    await cart.save();
    
    // Populate cart items for response
    await cart.populate('items.productId', 'name price currentEffectivePrice hasActivePriceChanges images category description allergens');
    
    res.status(200).json({
      success: true,
      message: 'Cart delivery settings updated successfully',
      data: transformCartForResponse(cart)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Merge guest cart with user cart after login
// @route   POST /api/cart/merge
// @access  Private
exports.mergeCart = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required for cart merge'
      });
    }
    
    // Find guest cart
    const guestCart = await Cart.findOne({ sessionId, status: 'active' });
    if (!guestCart || guestCart.items.length === 0) {
      // No guest cart to merge, just return user's existing cart
      let userCart = await Cart.findOrCreateCart(userId);
      await userCart.populate('items.productId', 'name price currentEffectivePrice hasActivePriceChanges images category description allergens');
      
      return res.status(200).json({
        success: true,
        message: 'No guest cart to merge',
        data: transformCartForResponse(userCart)
      });
    }
    
    // Find or create user cart
    let userCart = await Cart.findOrCreateCart(userId);
    
    // Merge items from guest cart to user cart
    for (const guestItem of guestCart.items) {
      await userCart.addItem(
        guestItem.productId,
        guestItem.quantity,
        Object.fromEntries(guestItem.selectedOptions || new Map()),
        guestItem.specialRequirements,
        guestItem.priceAtTime
      );
    }
    
    // Delete guest cart
    await Cart.findByIdAndDelete(guestCart._id);
    
    // Populate cart items for response
    await userCart.populate('items.productId', 'name price currentEffectivePrice hasActivePriceChanges images category description allergens');
    
    res.status(200).json({
      success: true,
      message: 'Cart merged successfully',
      data: transformCartForResponse(userCart)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get cart summary (lightweight version)
// @route   GET /api/cart/summary
// @access  Private/Public
exports.getCartSummary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication or session ID required'
      });
    }
    
    let query = { status: 'active' };
    if (userId) {
      query.userId = userId;
    } else {
      query.sessionId = sessionId;
    }
    
    const cart = await Cart.findOne(query);
    
    const summary = {
      itemCount: cart ? cart.itemCount : 0,
      subtotal: cart ? cart.subtotal : 0,
      deliveryFee: cart ? cart.deliveryFee : 0,
      total: cart ? cart.total : 0,
      hasItems: cart ? cart.items.length > 0 : false
    };
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
}; 
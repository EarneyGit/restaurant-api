const Order = require("../models/order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const Discount = require("../models/discount.model");
const OrderingTimes = require("../models/ordering-times.model");
const Category = require("../models/category.model");
const {
  checkStockAvailability,
  deductStock,
  restoreStock,
} = require("../utils/stockManager");
const { getIO } = require("../utils/socket");
const { MANAGEMENT_ROLES } = require("../constants/roles");
const {
  createPaymentIntent,
  getPaymentIntentStatus,
  refundPayment,
} = require("../utils/stripe-config/stripe-config");

// Update the populate options in all relevant methods
const populateOptions = {
  path: "products.product",
  select:
    "name price description images category allergens weight calorificValue availability",
};

// Helper function to calculate effective price from price changes
const calculateEffectivePrice = (basePrice, priceChanges) => {
  if (!priceChanges || priceChanges.length === 0) {
    return basePrice;
  }

  // Find the most recent active price change
  const activePriceChange = priceChanges.find((pc) => pc.active);
  if (!activePriceChange) {
    return basePrice;
  }

  // Calculate effective price based on price change type
  switch (activePriceChange.type) {
    case "temporary":
      return activePriceChange.tempPrice || activePriceChange.value;
    case "permanent":
    case "fixed":
      return activePriceChange.value;
    case "increase":
      return basePrice + activePriceChange.value;
    case "decrease":
      return Math.max(0, basePrice - activePriceChange.value);
    default:
      return basePrice;
  }
};

// Helper function to check if category is available at current time
const isCategoryAvailable = (category) => {
  if (!category?.availability) return true; // If no availability data, assume available

  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }); // Get full day name (Monday, Tuesday, etc.)
  const currentTime = now.toTimeString().substring(0, 5); // Get time in HH:MM format

  const dayAvailability = category.availability[currentDay];
  if (!dayAvailability) return true;

  // If not available for this day
  if (dayAvailability.type === 'Not Available') {
    return false;
  }

  // If available all day
  if (dayAvailability.type === 'All Day') {
    return true;
  }

  // If specific times, check if current time falls within the time slot
  if (dayAvailability.type === 'Specific Times') {
    if (!dayAvailability.startTime || !dayAvailability.endTime) {
      return false;
    }

    return currentTime >= dayAvailability.startTime && currentTime <= dayAvailability.endTime;
  }

  return true;
};

// Helper function to check if product is available at current time
const isProductAvailable = (product) => {
  // First check if the category is available - if not, product is not available
  if (product.category && typeof product.category === 'object' && product.category.availability) {
    if (!isCategoryAvailable(product.category)) {
      return false;
    }
  }

  if (!product.availability) return true; // If no availability data, assume available

  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase(); // Get day name (mon, tue, etc.)
  const currentTime = now.toTimeString().substring(0, 5); // Get time in HH:MM format

  // Map day names to availability keys
  const dayMap = {
    'mon': 'monday',
    'tue': 'tuesday', 
    'wed': 'wednesday',
    'thu': 'thursday',
    'fri': 'friday',
    'sat': 'saturday',
    'sun': 'sunday'
  };

  const dayKey = dayMap[currentDay];
  if (!dayKey || !product.availability[dayKey]) return true;

  const dayAvailability = product.availability[dayKey];

  // If not available for this day - type takes priority over isAvailable
  if (dayAvailability.type === 'Not Available') {
    return false;
  }

  // If available all day
  if (dayAvailability.type === 'All Day') {
    return dayAvailability.isAvailable;
  }

  // If specific times, check if current time falls within any time slot
  if (dayAvailability.type === 'Specific Times') {
    // For specific times, we need both isAvailable to be true AND have valid time slots
    if (!dayAvailability.isAvailable || !dayAvailability.times || dayAvailability.times.length === 0) {
      return false;
    }

    return dayAvailability.times.some(timeSlot => {
      return currentTime >= timeSlot.start && currentTime <= timeSlot.end;
    });
  }

  return true;
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public/Private (Branch-based)
exports.getOrders = async (req, res, next) => {
  try {
    let query = {};
    let targetBranchId = null;
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    const isRegularUser = userRole === "user" || userRole === null;

    // Handle branch determination based on user type
    if (isAdmin) {
      // Admin users: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`,
        });
      }
      targetBranchId = req.user.branchId;

      // Admin can only see orders from their branch
      query.branchId = targetBranchId;

      // Regular users can only see their own orders when authenticated
      if (userRole === "user") {
        query.user = req.user.id;
      }
    } else {
      // Regular users and guests: Use branch from query parameter
      if (!req.query.branchId) {
        return res.status(400).json({
          success: false,
          message: "Branch ID is required. Please select a branch.",
        });
      }

      targetBranchId = req.query.branchId;
      query.branchId = targetBranchId;

      // If authenticated regular user, only show their orders
      if (isAuthenticated && isRegularUser) {
        query.user = req.user.id;
      } else if (!isAuthenticated) {
        // Guest users cannot see orders - return empty result
        return res.status(403).json({
          success: false,
          message: "Authentication required to view orders",
        });
      }
    }

    // Additional filters for admin users only
    if (isAdmin) {
      // Filter today's orders if today=true
      if (req.query.today === "true") {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        query.createdAt = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
      }

      // Handle specific search parameters
      if (req.query.orderNumber) {
        query.orderNumber = { $regex: req.query.orderNumber, $options: "i" };
      }

      if (req.query.userName) {
        const users = await User.find({
          $or: [
            { firstName: { $regex: req.query.userName, $options: "i" } },
            { lastName: { $regex: req.query.userName, $options: "i" } },
          ],
        }).select("_id");

        const userIds = users.map((user) => user._id);
        query.user = { $in: userIds };
      }

      // Handle customerName parameter (used by frontend search)
      if (req.query.customerName) {
        const users = await User.find({
          $or: [
            { firstName: { $regex: req.query.customerName, $options: "i" } },
            { lastName: { $regex: req.query.customerName, $options: "i" } },
          ],
        }).select("_id");

        const userIds = users.map((user) => user._id);
        query.user = { $in: userIds };
      }

      if (req.query.mobileNumber) {
        const users = await User.find({
          phone: { $regex: req.query.mobileNumber, $options: "i" },
        }).select("_id");

        const userIds = users.map((user) => user._id);
        query.user = { $in: userIds };
      }

      // Handle phone parameter (used by frontend search)
      if (req.query.phone) {
        const users = await User.find({
          phone: { $regex: req.query.phone, $options: "i" },
        }).select("_id");

        const userIds = users.map((user) => user._id);
        query.user = { $in: userIds };
      }

      if (req.query.postCode) {
        query["deliveryAddress.postalCode"] = {
          $regex: req.query.postCode,
          $options: "i",
        };
      }

      // Handle postcode parameter (used by frontend search)
      if (req.query.postcode) {
        query["deliveryAddress.postalCode"] = {
          $regex: req.query.postcode,
          $options: "i",
        };
      }

      // Handle email parameter (used by frontend search)
      if (req.query.email) {
        const users = await User.find({
          email: { $regex: req.query.email, $options: "i" },
        }).select("_id");

        const userIds = users.map((user) => user._id);
        query.user = { $in: userIds };
      }

      // Other filters
      if (req.query.status) {
        query.status = req.query.status;
      }

      if (req.query.startDate && req.query.endDate) {
        query.createdAt = {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate),
        };
      }
    }

    const orders = await Order.find(query)
      .populate("user", "firstName lastName email phone")
      .populate("branchId", "name address")
      .populate(populateOptions)
      .populate("assignedTo", "firstName lastName email")
      .sort({ createdAt: -1 });

    // Transform the response to include complete product details
    const transformedOrders = orders.map((order) => {
      const orderObj = order.toObject();
      orderObj.products = orderObj.products.map((item) => {
        // Calculate attribute total for this product
        const attributeTotal = (item.selectedAttributes || []).reduce(
          (total, attr) =>
            total +
            attr.selectedItems.reduce(
              (sum, attrItem) => sum + attrItem.itemPrice * attrItem.quantity,
              0
            ),
          0
        );

        // Calculate item total with proper breakdown
        const baseTotal = item.price * item.quantity;
        const attributesTotalForQuantity = attributeTotal * item.quantity;
        const itemTotal = baseTotal + attributesTotalForQuantity;

        return {
          id: item._id,
          product: item.product,
          quantity: item.quantity,
          price: {
            base: item.price,
            currentEffectivePrice: item.price,
            attributes: attributeTotal,
            total: itemTotal,
          },
          notes: item.notes,
          selectedAttributes: item.selectedAttributes
            ? item.selectedAttributes.map((attr) => ({
                attributeId: attr.attributeId,
                attributeName: attr.attributeName,
                attributeType: attr.attributeType,
                selectedItems: attr.selectedItems.map((attrItem) => ({
                  itemId: attrItem.itemId,
                  itemName: attrItem.itemName,
                  itemPrice: attrItem.itemPrice,
                  quantity: attrItem.quantity,
                })),
              }))
            : [],
          itemTotal: itemTotal,
        };
      });

      // Calculate proper totals
      orderObj.subtotal = orderObj.products.reduce((total, p) => {
        return total + p.price.base * p.quantity;
      }, 0);

      orderObj.deliveryFee = orderObj.deliveryFee || 0;
      orderObj.finalTotal = orderObj.finalTotal || orderObj.totalAmount;

      // Enhanced discount information
      if (orderObj.discount) {
        orderObj.discount = {
          discountId: orderObj.discount.discountId,
          code: orderObj.discount.code,
          name: orderObj.discount.name,
          discountType: orderObj.discount.discountType,
          discountValue: orderObj.discount.discountValue,
          discountAmount: orderObj.discount.discountAmount,
          originalTotal: orderObj.discount.originalTotal,
        };
      }

      if (orderObj.discountApplied) {
        orderObj.discountApplied = {
          discountId: orderObj.discountApplied.discountId,
          code: orderObj.discountApplied.code,
          name: orderObj.discountApplied.name,
          discountType: orderObj.discountApplied.discountType,
          discountValue: orderObj.discountApplied.discountValue,
          discountAmount: orderObj.discountApplied.discountAmount,
          originalTotal: orderObj.discountApplied.originalTotal,
          appliedAt: orderObj.discountApplied.appliedAt,
        };
      }

      return orderObj;
    });

    res.status(200).json({
      success: true,
      count: transformedOrders.length,
      data: transformedOrders,
      branchId: targetBranchId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Public/Private (Branch-based)
exports.getOrder = async (req, res, next) => {
  try {
    // First validate the branch ID
    const requestedBranchId = req.query.branchId;
    if (!requestedBranchId) {
      return res.status(400).json({
        success: false,
        message: "Branch ID is required. Please select a branch.",
      });
    }

    // Find the order without populating user details first
    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`,
      });
    }

    // Check if order belongs to the requested branch
    if (order.branchId.toString() !== requestedBranchId) {
      return res.status(403).json({
        success: false,
        message: "Order not found in the selected branch",
      });
    }

    // Check if this is a guest order (no user associated)
    const isGuestOrder = !order.user;

    // If it's a user's order (not guest), require authentication
    if (!isGuestOrder) {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Please login to view this order",
          requiresAuth: true,
        });
      }

      // Determine user role
      const userRole = req.user.role;
      const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

      // Admin users: Check if order belongs to their branch
      if (isAdmin) {
        if (!req.user.branchId) {
          return res.status(403).json({
            success: false,
            message: `${userRole} must be assigned to a branch`,
          });
        }

        if (order.branchId.toString() !== req.user.branchId.toString()) {
          return res.status(403).json({
            success: false,
            message: "You do not have permission to view this order",
          });
        }
      }
      // Regular users: Can only view their own orders
      else if (order.user.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this order",
        });
      }
    }

    // Now populate the necessary fields based on the access type
    const populatedOrder = await Order.findById(order._id)
      .populate("branchId", "name address")
      .populate(populateOptions)
      .populate("user", "firstName lastName email phone")
      .populate("assignedTo", "firstName lastName email");

    // For guest orders or unauthorized access: Return public tracking info
    if (isGuestOrder || !req.user) {
      const publicOrderData = {
        _id: populatedOrder._id,
        user: populatedOrder.user,
        orderNumber: populatedOrder.orderNumber,
        status: populatedOrder.status,
        estimatedTimeToComplete: populatedOrder.estimatedTimeToComplete,
        createdAt: populatedOrder.createdAt,
        products: populatedOrder.products.map((p) => {
          // Calculate attribute total for this product
          const attributeTotal = (p.selectedAttributes || []).reduce(
            (total, attr) =>
              total +
              attr.selectedItems.reduce(
                (sum, item) => sum + item.itemPrice * item.quantity,
                0
              ),
            0
          );

          // Calculate item total with proper breakdown
          const baseTotal = p.price * p.quantity;
          const attributesTotalForQuantity = attributeTotal * p.quantity;
          const itemTotal = baseTotal + attributesTotalForQuantity;

          return {
            id: p._id,
            quantity: p.quantity,
            price: {
              base: p.price,
              currentEffectivePrice: p.price,
              attributes: attributeTotal,
              total: itemTotal,
            },
            product: {
              _id: p.product._id,
              name: p.product.name,
              description: p.product.description,
              images: p.product.images,
              price: p.product.price,
            },
            selectedAttributes: p.selectedAttributes
              ? p.selectedAttributes.map((attr) => ({
                  attributeId: attr.attributeId,
                  attributeName: attr.attributeName,
                  attributeType: attr.attributeType,
                  selectedItems: attr.selectedItems.map((item) => ({
                    itemId: item.itemId,
                    itemName: item.itemName,
                    itemPrice: item.itemPrice,
                    quantity: item.quantity,
                  })),
                }))
              : [],
            itemTotal: itemTotal,
            notes: p.notes || "",
          };
        }),
        branchId: {
          _id: populatedOrder.branchId._id,
          name: populatedOrder.branchId.name,
        },
        deliveryAddress: populatedOrder.deliveryAddress
          ? {
              street: populatedOrder.deliveryAddress.street,
              city: populatedOrder.deliveryAddress.city,
              postalCode: populatedOrder.deliveryAddress.postalCode,
            }
          : null,
        // Calculate proper totals
        subtotal: populatedOrder.products.reduce((total, p) => {
          return total + p.price * p.quantity;
        }, 0),
        deliveryFee: populatedOrder.deliveryFee || 0,
        totalAmount: populatedOrder.totalAmount,
        finalTotal: populatedOrder.finalTotal || populatedOrder.totalAmount,
        // Enhanced discount information
        discount: populatedOrder.discount
          ? {
              discountId: populatedOrder.discount.discountId,
              code: populatedOrder.discount.code,
              name: populatedOrder.discount.name,
              discountType: populatedOrder.discount.discountType,
              discountValue: populatedOrder.discount.discountValue,
              discountAmount: populatedOrder.discount.discountAmount,
              originalTotal: populatedOrder.discount.originalTotal,
            }
          : null,
        discountApplied: populatedOrder.discountApplied
          ? {
              discountId: populatedOrder.discountApplied.discountId,
              code: populatedOrder.discountApplied.code,
              name: populatedOrder.discountApplied.name,
              discountType: populatedOrder.discountApplied.discountType,
              discountValue: populatedOrder.discountApplied.discountValue,
              discountAmount: populatedOrder.discountApplied.discountAmount,
              originalTotal: populatedOrder.discountApplied.originalTotal,
              appliedAt: populatedOrder.discountApplied.appliedAt,
            }
          : null,
        stripePaymentIntentId: populatedOrder.stripePaymentIntentId || null,
      };

      return res.status(200).json({
        success: true,
        data: publicOrderData,
        isGuestOrder,
      });
    }

    // Transform the response for authenticated users
    const orderObj = populatedOrder.toObject();
    orderObj.products = orderObj.products.map((item) => {
      // Calculate attribute total for this product
      const attributeTotal = (item.selectedAttributes || []).reduce(
        (total, attr) =>
          total +
          attr.selectedItems.reduce(
            (sum, attrItem) => sum + attrItem.itemPrice * attrItem.quantity,
            0
          ),
        0
      );

      // Calculate item total with proper breakdown
      const baseTotal = item.price * item.quantity;
      const attributesTotalForQuantity = attributeTotal * item.quantity;
      const itemTotal = baseTotal + attributesTotalForQuantity;

      return {
        id: item._id,
        product: item.product,
        quantity: item.quantity,
        price: {
          base: item.price,
          currentEffectivePrice: item.price,
          attributes: attributeTotal,
          total: itemTotal,
        },
        notes: item.notes,
        selectedAttributes: item.selectedAttributes
          ? item.selectedAttributes.map((attr) => ({
              attributeId: attr.attributeId,
              attributeName: attr.attributeName,
              attributeType: attr.attributeType,
              selectedItems: attr.selectedItems.map((attrItem) => ({
                itemId: attrItem.itemId,
                itemName: attrItem.itemName,
                itemPrice: attrItem.itemPrice,
                quantity: attrItem.quantity,
              })),
            }))
          : [],
        itemTotal: itemTotal,
      };
    });

    // Calculate proper totals for authenticated response
    orderObj.subtotal = orderObj.products.reduce((total, p) => {
      return total + p.price.base * p.quantity;
    }, 0);

    orderObj.deliveryFee = orderObj.deliveryFee || 0;
    orderObj.finalTotal = orderObj.finalTotal || orderObj.totalAmount;

    // Enhanced discount information
    if (orderObj.discount) {
      orderObj.discount = {
        discountId: orderObj.discount.discountId,
        code: orderObj.discount.code,
        name: orderObj.discount.name,
        discountType: orderObj.discount.discountType,
        discountValue: orderObj.discount.discountValue,
        discountAmount: orderObj.discount.discountAmount,
        originalTotal: orderObj.discount.originalTotal,
      };
    }

    if (orderObj.discountApplied) {
      orderObj.discountApplied = {
        discountId: orderObj.discountApplied.discountId,
        code: orderObj.discountApplied.code,
        name: orderObj.discountApplied.name,
        discountType: orderObj.discountApplied.discountType,
        discountValue: orderObj.discountApplied.discountValue,
        discountAmount: orderObj.discountApplied.discountAmount,
        originalTotal: orderObj.discountApplied.originalTotal,
        appliedAt: orderObj.discountApplied.appliedAt,
      };
    }
    orderObj.stripePaymentIntentId =
      populatedOrder.stripePaymentIntentId || null;

    return res.status(200).json({
      success: true,
      data: orderObj,
      isGuestOrder,
    });
  } catch (error) {
    console.error("Order retrieval error:", error);
    next(error);
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Public/Private (Branch-based)
exports.createOrder = async (req, res, next) => {
  try {
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    const isRegularUser = userRole === "user" || userRole === null;

    let targetBranchId = null;

    // Handle branch determination based on user type
    if (isAdmin) {
      // Admin users: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`,
        });
      }
      targetBranchId = req.user.branchId;
      req.body.branchId = targetBranchId; // Override any provided branchId
    } else {
      // Regular users and guests: Use branch from request body
      if (!req.body.branchId) {
        return res.status(400).json({
          success: false,
          message: "Branch ID is required. Please select a branch.",
        });
      }
      targetBranchId = req.body.branchId;
    }

    // Set user if authenticated
    if (isAuthenticated) {
      req.body.user = req.user.id;
    }

    // Verify products exist and belong to the specified branch
    if (
      !req.body.products ||
      !Array.isArray(req.body.products) ||
      req.body.products.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Products are required",
      });
    }

    // Validate product IDs and check branch assignment
    const validatedProducts = [];

    for (let i = 0; i < req.body.products.length; i++) {
      const item = req.body.products[i];

      if (!item.product || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: "Product ID and quantity are required for each item",
        });
      }

      const product = await Product.findById(item.product)
        .populate("category", "name availability")
        .populate({
          path: "priceChanges",
          match: {
            active: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
          },
        });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found with id of ${item.product}`,
        });
      }

      if (product.branchId.toString() !== targetBranchId.toString()) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} does not belong to the selected branch`,
        });
      }

      // Check product and category availability
      if (!isProductAvailable(product)) {
        const categoryName = product.category?.name || 'Unknown Category';
        const categoryUnavailable = product.category && !isCategoryAvailable(product.category);
      
        const message = categoryUnavailable
          ? `Product "${product.name}" and its category "${categoryName}" are not available at this time.`
          : `Product "${product.name}" is not available at this time.`;
      
        return res.status(400).json({
          success: false,
          message,
        });
      }
      

      // Calculate effective price considering active price changes
      const effectivePrice = calculateEffectivePrice(
        product.price,
        product.priceChanges
      );

      // Add product with effective price to order item
      validatedProducts.push({
        product: item.product,
        quantity: item.quantity,
        price: effectivePrice,
        notes: item.notes,
        selectedAttributes: item.selectedAttributes || [],
      });
    }

    // Check stock availability for all products
    const stockCheck = await checkStockAvailability(validatedProducts);

    if (!stockCheck.success) {
      return res.status(400).json({
        success: false,
        message: "Stock validation failed",
        errors: stockCheck.errors,
        stockInfo: stockCheck.stockInfo,
      });
    }

    // Update the products array with validated data
    req.body.products = validatedProducts;

    // Calculate total amount first (including attribute prices)
    const totalAmount = validatedProducts.reduce((total, item) => {
      let itemTotal = item.price * item.quantity;

      // Add attribute item prices
      if (item.selectedAttributes && item.selectedAttributes.length > 0) {
        const attributeTotal = item.selectedAttributes.reduce(
          (attrTotal, attr) => {
            if (attr.selectedItems && attr.selectedItems.length > 0) {
              const attrItemTotal = attr.selectedItems.reduce(
                (itemSum, selectedItem) => {
                  return (
                    itemSum + selectedItem.itemPrice * selectedItem.quantity
                  );
                },
                0
              );
              return attrTotal + attrItemTotal;
            }
            return attrTotal;
          },
          0
        );

        // Multiply attribute total by product quantity
        itemTotal += attributeTotal * item.quantity;
      }

      return total + itemTotal;
    }, 0);

    req.body.totalAmount = totalAmount;

    // Coupon validation and discount calculation
    let discountData = null;
    let finalTotal = totalAmount;

    if (req.body.couponCode) {
      try {
        // Priority 1: Find the coupon and check if it exists and is active
        const discount = await Discount.findOne({
          code: req.body.couponCode.toUpperCase(),
          isActive: true,
        });

        if (!discount) {
          return res.status(400).json({
            success: false,
            message: "Invalid coupon code",
          });
        }

        // Create order object for validation
        const orderForValidation = {
          totalAmount: totalAmount,
          deliveryMethod: req.body.deliveryMethod,
          orderType: req.body.orderType,
        };

        // Priority-based validation using the new method
        const userId = isAuthenticated ? req.user.id : null;
        console.log(
          `Validating coupon ${req.body.couponCode} for user: ${userId}, branch: ${targetBranchId}`
        );

        const validation = await discount.validateForOrderCreation(
          orderForValidation,
          userId,
          targetBranchId.toString()
        );

        if (!validation.valid) {
          console.log(`Coupon validation failed: ${validation.reason}`);
          return res.status(400).json({
            success: false,
            message: validation.reason,
          });
        }

        console.log(`Coupon validation passed for ${req.body.couponCode}`);

        // Calculate discount amount
        const discountAmount = discount.calculateDiscount(totalAmount);
        finalTotal = Math.max(0, totalAmount - discountAmount);

        // Prepare discount data for order
        discountData = {
          discountId: discount._id,
          code: discount.code,
          name: discount.name,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          discountAmount: discountAmount,
          originalTotal: totalAmount,
        };

        // Set discount information in the order data
        req.body.discount = discountData;
        req.body.discountApplied = {
          ...discountData,
          appliedAt: new Date(),
        };
        req.body.finalTotal = finalTotal;

        console.log(
          `Discount applied: ${discountAmount}, Final total: ${finalTotal}`
        );
      } catch (error) {
        console.error("Error validating coupon:", error);
        return res.status(500).json({
          success: false,
          message: "Error validating coupon code",
        });
      }
    } else {
      // No coupon applied, final total equals total amount
      req.body.finalTotal = totalAmount;
    }

    // Get estimated time to complete based on ordering times configuration
    let estimatedTimeToComplete = 45; // Default 45 minutes

    try {
      // Get current day of the week
      const currentDate = new Date();
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const currentDay = dayNames[currentDate.getDay()];

      // Find ordering times for the branch
      const orderingTimes = await OrderingTimes.findOne({
        branchId: targetBranchId,
      });

      if (
        orderingTimes &&
        orderingTimes.weeklySchedule &&
        orderingTimes.weeklySchedule[currentDay]
      ) {
        const daySettings = orderingTimes.weeklySchedule[currentDay];

        // Map delivery method to ordering times field
        let orderType = "";
        switch (req.body.deliveryMethod) {
          case "pickup":
            orderType = "collection";
            break;
          case "delivery":
            orderType = "delivery";
            break;
          case "dine_in":
            orderType = "tableOrdering";
            break;
          default:
            orderType = "collection";
        }

        // Get lead time based on order type
        if (
          daySettings[orderType] &&
          typeof daySettings[orderType].leadTime === "number"
        ) {
          estimatedTimeToComplete = daySettings[orderType].leadTime;
        }
      }
    } catch (error) {
      // If there's an error fetching ordering times, use default value
      console.log(
        "Error fetching ordering times, using default lead time:",
        error.message
      );
    }

    // Set the estimated time to complete
    req.body.estimatedTimeToComplete = estimatedTimeToComplete;

    // Handle payment processing based on payment method
    if (req.body.paymentMethod === "card") {
      try {
        // Create payment intent for card payments
        const paymentIntent = await createPaymentIntent(
          Math.round(finalTotal * 100), // Convert to cents
          "gbp", // Currency - adjust as needed
          `Order payment for ${req.body.orderNumber || "restaurant order"}`
        );

        // Add stripe payment information to order
        req.body.stripePaymentIntentId = paymentIntent.id; // <-- Store the actual payment intent ID
        req.body.stripeClientSecret = paymentIntent.clientSecret;
        req.body.paymentStatus = "pending";

        console.log("Payment intent created:", paymentIntent);
      } catch (error) {
        console.error("Error creating payment intent:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to create payment intent. Please try again.",
        });
      }
    } else if (req.body.paymentMethod === "cash_on_delivery") {
      // For cash on delivery, set payment status to pending
      req.body.paymentStatus = "pending";
    }

    // Create the order
    const order = await Order.create(req.body);

    // Deduct stock for managed products after successful order creation
    const stockDeduction = await deductStock(validatedProducts);

    // Populate order data for response
    const populatedOrder = await Order.findById(order._id)
      .populate("user", "firstName lastName email phone")
      .populate("branchId", "name address")
      .populate(populateOptions)
      .populate("assignedTo", "firstName lastName email");

    // Emit socket event to restaurant staff
    getIO().emit("order", { event: "order_created" });

    // Prepare response data
    const responseData = {
      success: true,
      data: populatedOrder,
      discount: discountData,
      finalTotal: finalTotal,
      savings: discountData ? discountData.discountAmount : 0,
      stockDeduction: stockDeduction.updated,
      branchId: targetBranchId,
    };

    // Add payment information if card payment
    if (req.body.paymentMethod === "card" && req.body.stripeClientSecret) {
      responseData.payment = {
        clientSecret: req.body.stripeClientSecret,
        paymentIntentId: req.body.stripePaymentIntentId,
        orderId: order._id,
        amount: Math.round(finalTotal * 100), // Amount in cents
        currency: "gbp", // Adjust as needed
      };
    }

    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private (Admin/Manager/Staff only)
exports.updateOrder = async (req, res, next) => {
  try {
    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`,
      });
    }

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    // Only admin users can update orders
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can update orders",
      });
    }

    // Admin users: Check if order belongs to their branch
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    if (order.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update orders from other branches",
      });
    }

    const oldStatus = order.status;
    const newStatus = req.body.status;

    // If order is being cancelled, restore stock and process refund if needed
    if (newStatus === "cancelled" && oldStatus !== "cancelled") {
      const stockRestoration = await restoreStock(order.products);

      // Process refund if payment was made online or by card
      let refundResult = null;
      if (
        (order.paymentMethod === "card" || order.paymentMethod === "online") &&
        order.stripePaymentIntentId &&
        order.paymentStatus === "paid"
      ) {
        try {
          console.log(
            `Processing refund for order ${order._id} with payment intent ${order.stripePaymentIntentId}`
          );
          refundResult = await refundPayment(order.stripePaymentIntentId);

          // Update payment status to refunded
          req.body.paymentStatus = "refunded";
          console.log("Refund processed successfully:", refundResult);
        } catch (refundError) {
          console.error("Error processing refund:", refundError);
          // Continue with cancellation even if refund fails
        }
      }

      // Update with full body
      order = await Order.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
        .populate("user", "firstName lastName email phone")
        .populate("branchId", "name address")
        .populate(populateOptions)
        .populate("assignedTo", "firstName lastName email");

      // Emit socket event for cancelled order
      getIO().emit("order", { event: "order_cancelled" });

      res.status(200).json({
        success: true,
        data: order,
        stockRestoration: stockRestoration.restored,
        refundResult: refundResult,
      });
    } else {
      // Update with full body (no stock changes)
      order = await Order.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
        .populate("user", "firstName lastName email phone")
        .populate("branchId", "name address")
        .populate(populateOptions)
        .populate("assignedTo", "firstName lastName email");

      // Emit socket event for order update
      getIO().emit("order", { event: "order_updated" });

      res.status(200).json({
        success: true,
        data: order,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Stripe webhook handler
// @route   POST /api/orders/stripe-webhook
// @access  Public (Stripe webhook)
exports.stripeWebhook = async (req, res, next) => {
  try {
    const event = req.body;

    console.log("Stripe webhook event received:", event.type);

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;
      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(event.data.object);
        break;
      case "payment_intent.processing":
        await handlePaymentIntentProcessing(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Helper function to handle payment intent succeeded
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const order = await Order.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!order) {
      console.log("Order not found for payment intent:", paymentIntent.id);
      return;
    }

    // Update order payment status
    const updateData = {
      paymentStatus: "paid",
      stripePaymentDate: new Date(),
      stripePaymentMethod: paymentIntent.payment_method || "card",
    };

    // If order was in pending status, move to processing
    if (order.status === "pending") {
      updateData.status = "processing";
    }

    await Order.findByIdAndUpdate(order._id, updateData);

    console.log("Order payment succeeded:", order._id);

    // Emit socket event for order update
    getIO().emit("order", {
      event: "order_payment_succeeded",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error handling payment intent succeeded:", error);
  }
}

// Helper function to handle payment intent failed
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    const order = await Order.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!order) {
      console.log("Order not found for payment intent:", paymentIntent.id);
      return;
    }

    // Update order payment status
    const updateData = {
      paymentStatus: "failed",
      stripePaymentDate: new Date(),
    };

    // If order was in pending status, mark as cancelled
    if (order.status === "pending") {
      updateData.status = "cancelled";
    }

    await Order.findByIdAndUpdate(order._id, updateData);

    console.log("Order payment failed:", order._id);

    // Emit socket event for order update
    getIO().emit("order", {
      event: "order_payment_failed",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error handling payment intent failed:", error);
  }
}

// Helper function to handle payment intent canceled
async function handlePaymentIntentCanceled(paymentIntent) {
  try {
    const order = await Order.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!order) {
      console.log("Order not found for payment intent:", paymentIntent.id);
      return;
    }

    // Update order payment status
    const updateData = {
      paymentStatus: "failed",
      stripePaymentDate: new Date(),
    };

    // If order was in pending status, mark as cancelled
    if (order.status === "pending") {
      updateData.status = "cancelled";
    }

    await Order.findByIdAndUpdate(order._id, updateData);

    console.log("Order payment canceled:", order._id);

    // Emit socket event for order update
    getIO().emit("order", {
      event: "order_payment_canceled",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error handling payment intent canceled:", error);
  }
}

// Helper function to handle payment intent processing
async function handlePaymentIntentProcessing(paymentIntent) {
  try {
    const order = await Order.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!order) {
      console.log("Order not found for payment intent:", paymentIntent.id);
      return;
    }

    // Update order payment status
    const updateData = {
      paymentStatus: "processing",
      stripePaymentDate: new Date(),
    };

    await Order.findByIdAndUpdate(order._id, updateData);

    console.log("Order payment processing:", order._id);

    // Emit socket event for order update
    getIO().emit("order", {
      event: "order_payment_processing",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error handling payment intent processing:", error);
  }
}

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Public (temporarily)
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "branchId",
      "_id name"
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with id of ${req.params.id}`,
      });
    }

    // Store order info before deletion
    const orderInfo = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      branchId: order.branchId._id,
    };

    await order.deleteOne();

    // Emit socket event for order deletion
    getIO().emit("order", { event: "order_deleted" });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user orders
// @route   GET /api/orders/myorders
// @access  Private (Authenticated users only)
exports.getMyOrders = async (req, res, next) => {
  try {
    // Authentication required
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Determine user role and branch
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);
    let targetBranchId = null;

    let query = { user: req.user.id };

    // Handle branch determination based on user type
    if (isAdmin) {
      // Admin users: Use their assigned branchId
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`,
        });
      }
      targetBranchId = req.user.branchId;
      query.branchId = targetBranchId;
    } else {
      // Regular users: branchId is optional
      if (req.query.branchId) {
        targetBranchId = req.query.branchId;
        query.branchId = targetBranchId;
      }
      // If no branchId provided, get orders from all branches
    }

    const orders = await Order.find(query)
      .populate("branchId", "name address")
      .populate(populateOptions)
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
      branchId: targetBranchId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's orders
// @route   GET /api/orders/today
// @access  Private (Admin only)
exports.getTodayOrders = async (req, res, next) => {
  try {
    // Authentication required
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Determine user role
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    // Only admin users can access today's orders
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access today's orders",
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Initialize query with date filter and branch filter
    let query = {
      branchId: req.user.branchId,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    // Apply status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    const orders = await Order.find(query)
      .populate("user", "firstName lastName email phone")
      .populate("branchId", "name address")
      .populate(populateOptions)
      .populate("assignedTo", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
      branchId: req.user.branchId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check payment status
// @route   POST /api/orders/check-payment-status
// @access  Public/Private (Order owner or admin)
exports.checkPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order has stripe payment intent
    if (!order.stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "No payment intent found for this order",
      });
    }

    try {
      // Get payment status from Stripe
      const paymentStatus = await getPaymentIntentStatus(
        order.stripePaymentIntentId
      );

      // Update order based on payment status
      let updateData = {};
      let orderStatus = order.status;

      if (
        paymentStatus.success &&
        paymentStatus.message === "Payment successful"
      ) {
        // Payment succeeded - update order status
        updateData.paymentStatus = "paid";
        updateData.stripePaymentDate = new Date();

        // If order was in pending payment status, move to processing
        if (order.status === "pending") {
          updateData.status = "pending";
          orderStatus = "processing";
        }
      } else if (paymentStatus.message === "Payment is still processing") {
        // Payment still processing
        updateData.paymentStatus = "processing";
      } else if (
        paymentStatus.message.includes("failed") ||
        paymentStatus.message.includes("canceled")
      ) {
        // Payment failed
        updateData.paymentStatus = "failed";

        // If order was in pending status, mark as cancelled
        if (order.status === "pending") {
          updateData.status = "cancelled";
          orderStatus = "cancelled";
        }
      }

      // Update order with new payment status
      const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, {
        new: true,
        runValidators: true,
      })
        .populate("user", "firstName lastName email phone")
        .populate("branchId", "name address")
        .populate(populateOptions)
        .populate("assignedTo", "firstName lastName email");

      // Emit socket event for order update
      getIO().emit("order", { event: "order_payment_updated" });

      res.status(200).json({
        success: true,
        data: {
          order: updatedOrder,
          paymentStatus: paymentStatus,
          orderStatus: orderStatus,
          message: paymentStatus.message,
        },
      });
    } catch (stripeError) {
      console.error("Error checking payment status:", stripeError);
      return res.status(500).json({
        success: false,
        message: "Error checking payment status",
        error: stripeError.message,
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel (refund) a payment
// @route   POST /api/orders/cancel-payment/:paymentIntentId
// @access  Public/Private (Order owner or admin)
exports.cancelPayment = async (req, res) => {
  const { paymentIntentId } = req.params;
  try {
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Payment Intent ID is required",
      });
    }
    const refund = await refundPayment(paymentIntentId);
    return res.status(200).json({
      success: true,
      message: "Payment cancelled and refunded successfully",
      refund,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel payment",
    });
  }
};

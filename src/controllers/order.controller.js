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
  updatePaymentIntentDescription,
} = require("../utils/stripe-config/stripe-config");
const Cart = require("../models/cart.model");
const ServiceCharge = require("../models/service-charge.model");
const {
  sendMailForOrderCreated,
  sendMailForAddDelay,
  sendMailForCancelOrder,
  sendMailForRefundOrder,
} = require("../utils/emailSender");
const { getOrderCustomerDetails } = require("../utils/functions");

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
  const currentDay = now.toLocaleDateString("en-GB", { weekday: "long" }); // Get full day name (Monday, Tuesday, etc.)
  const currentTime = now.toTimeString().substring(0, 5); // Get time in HH:MM format

  const dayAvailability = category.availability[currentDay];
  if (!dayAvailability) return true;

  // If not available for this day
  if (dayAvailability.type === "Not Available") {
    return false;
  }

  // If available all day
  if (dayAvailability.type === "All Day") {
    return true;
  }

  // If specific times, check if current time falls within the time slot
  if (dayAvailability.type === "Specific Times") {
    if (!dayAvailability.startTime || !dayAvailability.endTime) {
      return false;
    }

    return (
      currentTime >= dayAvailability.startTime &&
      currentTime <= dayAvailability.endTime
    );
  }

  return true;
};

// Helper function to check if product is available at current time
const isProductAvailable = (product) => {
  // First check if the category is available - if not, product is not available
  if (
    product.category &&
    typeof product.category === "object" &&
    product.category.availability
  ) {
    if (!isCategoryAvailable(product.category)) {
      return false;
    }
  }

  if (!product.availability) return true; // If no availability data, assume available

  const now = new Date();
  const currentDay = now
    .toLocaleDateString("en-GB", { weekday: "short" })
    .toLowerCase(); // Get day name (mon, tue, etc.)
  const currentTime = now.toTimeString().substring(0, 5); // Get time in HH:MM format

  // Map day names to availability keys
  const dayMap = {
    mon: "monday",
    tue: "tuesday",
    wed: "wednesday",
    thu: "thursday",
    fri: "friday",
    sat: "saturday",
    sun: "sunday",
  };

  const dayKey = dayMap[currentDay];
  if (!dayKey || !product.availability[dayKey]) return true;

  const dayAvailability = product.availability[dayKey];

  // If not available for this day - type takes priority over isAvailable
  if (dayAvailability.type === "Not Available") {
    return false;
  }

  // If available all day
  if (dayAvailability.type === "All Day") {
    return dayAvailability.isAvailable;
  }

  // If specific times, check if current time falls within any time slot
  if (dayAvailability.type === "Specific Times") {
    // For specific times, we need both isAvailable to be true AND have valid time slots
    if (
      !dayAvailability.isAvailable ||
      !dayAvailability.times ||
      dayAvailability.times.length === 0
    ) {
      return false;
    }

    return dayAvailability.times.some((timeSlot) => {
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

      // Filter out card payment orders that are not paid yet
      // query.$or = [
      //   { paymentMethod: { $ne: "card" } },
      //   { paymentMethod: "card", paymentStatus: "paid" },
      // ];

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
        const start = new Date(req.query.startDate);
        const end = new Date(req.query.endDate);
        // Normalize to cover full days
        const startOfDay = new Date(start.setHours(0, 0, 0, 0));
        const endOfDay = new Date(end.setHours(23, 59, 59, 999));
        query.createdAt = {
          $gte: startOfDay,
          $lte: endOfDay,
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

    // Check if this is a guest order (no user associated) or if we have a session ID for guest tracking
    const isGuestOrder = order.isGuestOrder;

    // For debugging
    console.log("Order access check:", {
      orderId: order._id,
      isGuestOrder,
    });

    // If it's a user's order (not guest) or guest trying to access non-matching order, require authentication
    if (!isGuestOrder) {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Please login to view this order",
          requiresAuth: true,
        });
      }
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
      } else if (order.user.toString() !== req.user.id.toString()) {
        // Regular users: Can only view their own orders
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this order",
        });
      }
    }

    // Now populate the necessary fields based on the access type
    const populatedOrder = await Order.findById(order._id)
      .populate("branchId", "name address location")
      .populate(populateOptions)
      .populate("user", "firstName lastName email phone")
      .populate("assignedTo", "firstName lastName email");

    // For guest orders or unauthorized access: Return public tracking info
    if (isGuestOrder) {
      const publicOrderData = {
        _id: populatedOrder._id,
        user: populatedOrder.user,
        isGuestOrder: populatedOrder.isGuestOrder,
        orderCustomerDetails: populatedOrder.orderCustomerDetails,
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
        total: populatedOrder.total,
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
        customerNotes: populatedOrder.customerNotes || null,
        serviceCharge: populatedOrder.serviceCharge || null,
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
    orderObj.customerNotes = populatedOrder.customerNotes || null;
    orderObj.serviceCharge = populatedOrder.serviceCharge || null;

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

    // Handle guest user account creation
    if (!isAuthenticated && req.body.isGuest && req.body.guestUserInfo) {
      try {
        const { email, firstName, lastName, phone, address } =
          req.body.guestUserInfo;

        // Check if user with this email already exists
        let existingUser = await User.findOne({ email: email.toLowerCase() });

        if (!existingUser) {
          // Create a new user account with null password
          const newUser = new User({
            email: email.toLowerCase(),
            firstName,
            lastName,
            phone,
            address,
            password: null, // Setting null password as requested
            emailVerified: false,
            isGuest: true,
          });

          // Save the user without password validation
          existingUser = await newUser.save({ validateBeforeSave: false });
          console.log(`Created new guest user account for: ${email}`);
        } else {
          console.log(`Using existing account for guest user: ${email}`);
        }

        // Associate the order with this user
        req.body.user = existingUser._id;
        req.body.customerId = existingUser._id;
      } catch (userError) {
        console.error("Error creating guest user account:", userError);
        // Continue with order creation even if user account creation fails
      }
    } else if (isAuthenticated) {
      // Set user if authenticated
      req.body.user = req.user.id;
    } else {
      // For guest users, set customerId from session ID
      const sessionId = req.headers["x-session-id"];
      if (sessionId) {
        req.body.customerId = sessionId;
        console.log(`Setting customerId for guest order: ${sessionId}`);
      }
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
        const categoryName = product.category?.name || "Unknown Category";
        const categoryUnavailable =
          product.category && !isCategoryAvailable(product.category);

        const message = categoryUnavailable
          ? `Product "${product.name}" and its category "${categoryName}" are not available at this time.`
          : `Product "${product.name}" is not available at this time.`;

        return res.status(400).json({
          success: false,
          message,
        });
      }

      // Check delivery method compatibility
      const deliveryMethod = req.body.deliveryMethod;
      if (deliveryMethod) {
        let isDeliveryMethodSupported = true;
        let deliveryMethodMessage = "";

        switch (deliveryMethod.toLowerCase()) {
          case "delivery":
            if (product.delivery === false) {
              isDeliveryMethodSupported = false;
              deliveryMethodMessage = `Product "${product.name}" is not available for delivery`;
            }
            break;
          case "pickup":
          case "collection":
            if (product.collection === false) {
              isDeliveryMethodSupported = false;
              deliveryMethodMessage = `Product "${product.name}" is not available for collection/pickup`;
            }
            break;
          case "dine_in":
          case "table_ordering":
            if (product.dineIn === false) {
              isDeliveryMethodSupported = false;
              deliveryMethodMessage = `Product "${product.name}" is not available for dine-in`;
            }
            break;
        }

        if (!isDeliveryMethodSupported) {
          return res.status(400).json({
            success: false,
            message: deliveryMethodMessage,
          });
        }
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

    // Calculate delivery fee based on delivery address and order total
    let deliveryFee = 0;
    if (req.body.deliveryMethod === "delivery" && req.body.deliveryAddress) {
      try {
        // Prepare address for delivery validation
        const customerAddress = {
          postcode:
            req.body.deliveryAddress.postalCode ||
            req.body.deliveryAddress.postcode,
          street: req.body.deliveryAddress.street,
          city: req.body.deliveryAddress.city,
          country: req.body.deliveryAddress.country || "GB",
          fullAddress: req.body.deliveryAddress.fullAddress,
          longitude: req.body.deliveryAddress.longitude,
          latitude: req.body.deliveryAddress.latitude,
        };

        // Create a mock request/response for the delivery validation
        const mockReq = {
          body: {
            branchId: targetBranchId,
            orderTotal: totalAmount,
            searchedAddress: customerAddress,
          },
        };

        let validationResult = null;
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              validationResult = { statusCode: code, data };
              return { statusCode: code, data };
            },
          }),
        };

        // Call the delivery validation function
        const {
          validateDeliveryDistance,
        } = require("./delivery-charge.controller");
        await validateDeliveryDistance(mockReq, mockRes);

        // Check if delivery is valid
        if (
          validationResult &&
          validationResult.statusCode === 200 &&
          validationResult.data.success &&
          validationResult.data.deliverable
        ) {
          deliveryFee = validationResult.data.data.charge;
        } else {
          // Delivery is not valid, return error
          const errorMessage =
            validationResult?.data?.message ||
            "Delivery not available to this location";
          return res.status(400).json({
            success: false,
            message: errorMessage,
            deliverable: false,
          });
        }
      } catch (error) {
        console.error("Error validating delivery for order:", error);
        return res.status(400).json({
          success: false,
          message: "Unable to validate delivery. Please try again.",
          deliverable: false,
        });
      }
    }

    // Add delivery fee to request body
    req.body.deliveryFee = deliveryFee;
    req.body.totalAmount = totalAmount;

    // Helper function to map frontend order types to service charge order types
    const mapOrderTypeForServiceCharge = (orderType) => {
      const orderTypeMap = {
        delivery: "delivery",
        pickup: "pickup",
        collection: "collection",
        "dine-in": "dine-in",
        dine_in: "dine-in",
      };

      return orderTypeMap[orderType.toLowerCase()] || "delivery";
    };

    // Calculate service charges
    let serviceCharges = {
      totalMandatory: 0,
      totalOptional: 0,
      totalAll: 0,
      breakdown: [],
    };

    try {
      // Map the order type for service charge calculation
      const mappedOrderType = mapOrderTypeForServiceCharge(
        req.body.deliveryMethod || "delivery"
      );

      // Get accepted optional service charges from request
      const acceptedOptionalCharges =
        req.body.acceptedOptionalServiceCharges || [];

      const calculatedCharges = await ServiceCharge.calculateTotalCharges(
        targetBranchId,
        mappedOrderType,
        totalAmount + deliveryFee, // Include delivery fee in service charge calculation
        true // include optional charges
      );

      // Filter optional charges based on acceptance
      if (acceptedOptionalCharges && acceptedOptionalCharges.length > 0) {
        const filteredBreakdown = calculatedCharges.breakdown.map((charge) => {
          if (charge.optional) {
            return {
              ...charge,
              accepted: acceptedOptionalCharges.includes(charge.id),
            };
          }
          return charge;
        });

        const acceptedOptionalTotal = filteredBreakdown
          .filter((charge) => charge.optional && charge.accepted)
          .reduce((total, charge) => total + charge.amount, 0);

        serviceCharges = {
          totalMandatory: calculatedCharges.totalMandatory || 0,
          totalOptional: acceptedOptionalTotal,
          totalAll: calculatedCharges.totalMandatory + acceptedOptionalTotal,
          breakdown: filteredBreakdown.map((item) => ({
            id: item.id ? item.id.toString() : "",
            name: item.name || "",
            type: item.type || "",
            value: item.value || 0,
            amount: item.amount || 0,
            optional: item.optional || false,
            accepted: item.accepted || false,
          })),
        };
      } else {
        // No optional charges accepted
        serviceCharges = {
          totalMandatory: calculatedCharges.totalMandatory || 0,
          totalOptional: 0,
          totalAll: calculatedCharges.totalMandatory || 0,
          breakdown: calculatedCharges.breakdown.map((item) => ({
            id: item.id ? item.id.toString() : "",
            name: item.name || "",
            type: item.type || "",
            value: item.value || 0,
            amount: item.amount || 0,
            optional: item.optional || false,
            accepted: false,
          })),
        };
      }
    } catch (error) {
      console.error("Error calculating service charges:", error);
      // Continue with order creation even if service charge calculation fails
    }

    // Add service charges and delivery fee to total amount
    const totalWithDeliveryAndServiceCharges =
      totalAmount + deliveryFee + serviceCharges.totalMandatory;
    req.body.totalAmount = totalWithDeliveryAndServiceCharges;
    req.body.serviceCharges = serviceCharges;
    req.body.serviceCharge = serviceCharges.totalMandatory; // Legacy field for backward compatibility

    // Coupon validation and discount calculation
    let discountData = null;
    let finalTotal = totalWithDeliveryAndServiceCharges;

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
          totalAmount: totalWithDeliveryAndServiceCharges,
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
        const discountAmount = discount.calculateDiscount(
          totalWithDeliveryAndServiceCharges
        );
        finalTotal = Math.max(
          0,
          totalWithDeliveryAndServiceCharges - discountAmount
        );

        // Prepare discount data for order
        discountData = {
          discountId: discount._id,
          code: discount.code,
          name: discount.name,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          discountAmount: discountAmount,
          originalTotal: totalWithDeliveryAndServiceCharges,
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
      // No coupon applied, final total equals total with delivery and service charges
      req.body.finalTotal = totalWithDeliveryAndServiceCharges;
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
    } else if (req.body.paymentMethod === "cash") {
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

    // Only emit socket event for non-card payments or paid card payments
    if (
      req.body.paymentMethod !== "card" ||
      req.body.paymentStatus === "paid"
    ) {
      getIO().emit("order", { event: "order_created" });
    } else {
      console.log(
        "Not emitting order_created event for unpaid card payment order:",
        order._id
      );
    }

    // Prepare response data
    const responseData = {
      success: true,
      data: populatedOrder,
      discount: discountData,
      serviceCharges: serviceCharges,
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
    // clear cart after order creation
    clearCart(
      responseData.data.customerId,
      req.body.sessionId,
      targetBranchId
    ).catch((error) => {
      console.error("Error clearing cart:", error);
    });

    // if user logged in, then save delivery address to user async
    if (
      isAuthenticated &&
      req.body.deliveryMethod === "delivery" &&
      req.body.deliveryAddress
    ) {
      saveDeliveryAddressToUser(req.user.id, req.body.deliveryAddress).catch(
        (error) => {
          console.error("Error saving delivery address to user:", error);
        }
      );
    }
    const userDetails = getOrderCustomerDetails(populatedOrder);
    populatedOrder.customerName =
      (userDetails.firstName + " " + userDetails.lastName).trim() ||
      userDetails.email ||
      "Customer";
    populatedOrder.customerEmail = userDetails.email;
    populatedOrder.customerPhone = userDetails.phone;
    populatedOrder.customerAddress = userDetails.address;
    // if payment method is cash , then send order created email or payment is paid, then send order paid email
    if (
      ["cash"].includes(populatedOrder.paymentMethod) ||
      (populatedOrder.paymentMethod === "card" &&
        populatedOrder.paymentStatus === "paid")
    ) {
      // send order created email
      sendMailForOrderCreated(
        populatedOrder.customerEmail,
        populatedOrder.branchId._id,
        populatedOrder
      ).catch((error) => {
        console.error("Error sending order created email:", error);
      });
    }

    // update payment intent description
    if (req.body.paymentMethod === "card" && req.body.stripePaymentIntentId) {
      updatePaymentIntentDescription(
        req.body.stripePaymentIntentId,
        `Order payment for ${
          populatedOrder.orderNumber +
          " - " +
          populatedOrder.customerName +
          " - " +
          populatedOrder.customerEmail
        }`
      ).catch((error) => {
        console.error("Error updating payment intent description:", error);
      });
    }
    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  }
};

// clear cart
async function clearCart(userId, sessionId, branchId) {
  console.log(
    "Clearing cart for user:",
    userId,
    "session:",
    sessionId,
    "branch:",
    branchId
  );
  try {
    if (userId) {
      await Cart.findOneAndUpdate(
        { userId: userId, branchId: branchId },
        { $set: { items: [] } }
      );
    }
    if (sessionId) {
      await Cart.findOneAndUpdate(
        { sessionId: sessionId, branchId: branchId },
        { $set: { items: [] } }
      );
    }
  } catch (error) {
    console.error("Error saving delivery address to user:", error);
    return false;
  }
}

// save delivery address to user
async function saveDeliveryAddressToUser(userId, deliveryAddress) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }
    deliveryAddress = {
      fullAddress: deliveryAddress.fullAddress,
      address: deliveryAddress.address,
      city: deliveryAddress.city,
      state: deliveryAddress.state,
      postalCode: deliveryAddress.postalCode,
      country: deliveryAddress.country,
      latitude: deliveryAddress.latitude,
      longitude: deliveryAddress.longitude,
      default: true,
    };
    if (user.deliveryAddresses && user.deliveryAddresses.length > 0) {
      user.deliveryAddresses = [...user.deliveryAddresses]
        .filter(
          (address) =>
            JSON.stringify(address.fullAddress) !==
            JSON.stringify(deliveryAddress.fullAddress)
        )
        .map((address) => ({
          ...address,
          default: false,
        }))
        .concat(deliveryAddress);
    } else {
      user.deliveryAddresses = [deliveryAddress];
    }
    await user.save();
    return true;
  } catch (error) {
    console.error("Error saving delivery address to user:", error);
    return false;
  }
}
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

      // Process refund if payment was made by card
      let refundResult = null;
      if (
        order.paymentMethod === "card" &&
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
      const userDetails = getOrderCustomerDetails(order);
      order.customerName =
        (userDetails.firstName + " " + userDetails.lastName).trim() ||
        userDetails.email ||
        "Customer";
      order.customerEmail = userDetails.email;
      order.customerPhone = userDetails.phone;
      // send cancel email
      sendMailForCancelOrder(
        order.customerEmail,
        order,
        "Order cancelled by admin"
      ).catch((error) => {
        console.error("Error sending cancel email:", error);
      });
      // send if payment method is card, then send order refunded email
      if (
        order.paymentMethod === "card" &&
        order.paymentStatus === "refunded"
      ) {
        sendMailForRefundOrder(order.customerEmail, order).catch((error) => {
          console.error("Error sending order refunded email:", error);
        });
      }

      res.status(200).json({
        success: true,
        data: order,
        stockRestoration: stockRestoration.restored,
        refundResult: refundResult,
      });
    } else {
      let delayMinutes = 0;
      // if estimated time to complete is changed, send delay email
      if (req.body.estimatedTimeToComplete) {
        delayMinutes =
          req.body.estimatedTimeToComplete - order.estimatedTimeToComplete;
      }
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

      // send delay email
      if (delayMinutes > 0) {
        const userDetails = getOrderCustomerDetails(order);
        order.customerName =
          (userDetails.firstName + " " + userDetails.lastName).trim() ||
          userDetails.email ||
          "Customer";
        order.customerEmail = userDetails.email;
        order.customerPhone = userDetails.phone;
        sendMailForAddDelay(
          order.customerEmail,
          order,
          delayMinutes,
          req.body.estimatedTimeToComplete
        );
      }

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

    // Emit socket events for order update
    getIO().emit("order", {
      event: "order_payment_succeeded",
      orderId: order._id,
    });

    // Also emit order_created event to make the order appear in live orders
    getIO().emit("order", {
      event: "order_created",
      orderId: order._id,
      orderNumber: order.orderNumber,
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

      const customerDetails = getOrderCustomerDetails(updatedOrder);
      updatedOrder.customerName =
        customerDetails.firstName + " " + customerDetails.lastName;
      updatedOrder.customerEmail = customerDetails.email;
      updatedOrder.customerPhone = customerDetails.phone;
      updatedOrder.customerAddress = customerDetails.address;
      if (updateData.paymentStatus === "paid") {
        getIO().emit("order", { event: "order_created", orderId: orderId });
        // if payment status is paid, then send order paid email
        sendMailForOrderCreated(
          updatedOrder.customerEmail,
          updatedOrder.branchId._id,
          updatedOrder
        ).catch((error) => {
          console.error("Error sending order created email:", error);
        });
      } else if (updateData.paymentStatus === "failed") {
        // if payment status is failed, then send order cancelled email
        sendMailForCancelOrder(
          updatedOrder.orderCustomerDetails.email,
          updatedOrder,
          "Payment failed"
        ).catch((error) => {
          console.error("Error sending order cancelled email:", error);
        });
      }

      // Emit socket event for order update
      getIO().emit("order", {
        event: "order_payment_updated",
        paymentStatus: updateData.paymentStatus,
      });

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

// @desc    Get customer orders with pagination
// @route   GET /api/orders/customer/:customerId
// @access  Private (Admin/Manager/Staff only)
exports.getCustomerOrders = async (req, res, next) => {
  try {
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    // Only admin users can access customer orders
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access customer orders",
      });
    }

    // Admin users: Check if they are assigned to a branch
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    const { customerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Validate customerId
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    // Find orders for this customer in admin's branch
    const query = {
      $or: [{ user: customerId }, { customerId: customerId }],
      branchId: req.user.branchId,
    };

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate("branchId", "name address")
      .populate(populateOptions)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Transform orders for response
    const transformedOrders = orders.map((order) => {
      const orderObj = order.toObject();

      // Calculate proper totals
      orderObj.subtotal = orderObj.products.reduce((total, p) => {
        return total + p.price * p.quantity;
      }, 0);

      orderObj.deliveryFee = orderObj.deliveryFee || 0;
      orderObj.finalTotal = orderObj.finalTotal || orderObj.totalAmount;

      // Format dates for easier display
      orderObj.formattedDate = new Date(orderObj.createdAt).toLocaleDateString(
        "en-GB",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );

      return {
        id: orderObj._id,
        orderNumber: orderObj.orderNumber,
        status: orderObj.status,
        paymentStatus: orderObj.paymentStatus,
        paymentMethod: orderObj.paymentMethod,
        orderType: orderObj.orderType || orderObj.deliveryMethod,
        totalAmount: orderObj.totalAmount,
        finalTotal: orderObj.finalTotal,
        createdAt: orderObj.createdAt,
        formattedDate: orderObj.formattedDate,
        products: orderObj.products.map((p) => ({
          name: p.product ? p.product.name : "Unknown Product",
          quantity: p.quantity,
          price: p.price,
        })),
      };
    });

    res.status(200).json({
      success: true,
      count: transformedOrders.length,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: transformedOrders,
      total: total,
    });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    next(error);
  }
};

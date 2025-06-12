const Product = require("../models/product.model");
const Category = require("../models/category.model");
const Branch = require("../models/branch.model");
const Attribute = require("../models/attribute.model");
const ProductAttributeItem = require("../models/product-attribute-item.model");
const {
  saveSingleFile,
  saveMultipleFiles,
  deleteFile,
} = require("../utils/fileUpload");
const { MANAGEMENT_ROLES } = require("../constants/roles");

// @desc    Get all products
// @route   GET /api/products
// @access  Public (Branch-based)
exports.getProducts = async (req, res, next) => {
  try {
    let query = {};
    let targetBranchId = null;

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    // Handle branch determination based on user type
    if (isAdmin && req.user.branchId) {
      // Admin users: Use their assigned branchId
      targetBranchId = req.user.branchId;
    } else if (req.query.branchId) {
      // Regular users and guests: Use branch from query parameter
      targetBranchId = req.query.branchId;
    } else {
      return res.status(400).json({
        success: false,
        message: "Branch ID is required. Please select a branch.",
      });
    }

    // Verify branch exists
    const branch = await Branch.findById(targetBranchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    // Set branch query
    query.branchId = targetBranchId;

    // Apply additional filters if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Add search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: "i" };
    }

    // Get products with populated fields
    const products = await Product.find(query)
      .populate("category", "name slug")
      .populate("branchId", "name address")
      .populate("selectedItems", "name price category")
      .populate({
        path: "priceChanges",
        match: {
          active: true,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        },
      })
      .sort("name");

    // Get product attributes for all products
    const productIds = products.map((product) => product._id);
    const attributes = await Attribute.find({ branchId: targetBranchId });
    const productAttributeItems = await ProductAttributeItem.find({
      productId: { $in: productIds },
      isActive: true,
    }).populate("attributeId");

    // Group attribute items by product
    const productAttributesMap = {};
    productAttributeItems.forEach((item) => {
      if (item.productId) {
        // Add null check
        const productIdStr = item.productId.toString();
        if (!productAttributesMap[productIdStr]) {
          productAttributesMap[productIdStr] = [];
        }
        productAttributesMap[productIdStr].push(item);
      }
    });

    // Transform products to match frontend structure
    const transformedProducts = products.map((product) => {
      const productId = product._id.toString();
      return {
        id: product._id,
        name: product.name,
        price: product.price,
        // currentEffectivePrice: product.currentEffectivePrice || product.price,
        // hasActivePriceChanges: product.hasActivePriceChanges || false,
        // activePriceChangeId: product.activePriceChangeId || null,
        attributes: attributes
          .map((attr) => ({
            id: attr._id,
            name: attr.name,
            type: attr.type,
            requiresSelection: attr.requiresSelection,
            description: attr.description,
            choices: (productAttributesMap[productId] || [])
              .filter(
                (item) =>
                  item.attributeId &&
                  item.attributeId._id.toString() === attr._id.toString()
              )
              .map((item) => ({
                id: item._id,
                name: item.name,
                price: item.price,
              })),
          }))
          .filter((attr) => attr.choices.length > 0),
        hideItem: product.hideItem ?? false,
        delivery: product.delivery !== undefined ? product.delivery : true,
        collection:
          product.collection !== undefined ? product.collection : true,
        dineIn: product.dineIn !== undefined ? product.dineIn : true,
        description: product.description,
        weight: product.weight,
        calorificValue: product.calorificValue,
        calorieDetails: product.calorieDetails,
        images: product.images || [],
        availability: product.availability || {},
        allergens: product.allergens || { contains: [], mayContain: [] },
        priceChanges: product.priceChanges || [],
        selectedItems: product.selectedItems?.map((item) => item._id) || [],
        itemSettings: product.itemSettings || {
          showSelectedOnly: false,
          showSelectedCategories: false,
          limitSingleChoice: false,
          addAttributeCharges: false,
          useProductPrices: false,
          showChoiceAsDropdown: false,
        },
        category: product.category,
        branch: product.branchId,
        tillProviderProductId: product.tillProviderProductId || "",
        cssClass: product.cssClass || "",
        freeDelivery: product.freeDelivery || false,
        collectionOnly: product.collectionOnly || false,
        deleted: product.deleted || false,
        hidePrice: product.hidePrice || false,
        allowAddWithoutChoices: product.allowAddWithoutChoices || false,
        stockManagement: product.stockManagement || {
          isManaged: false,
          quantity: 0,
          lowStockThreshold: 10,
          lastUpdated: new Date(),
        },
      };
    });

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      data: transformedProducts,
      branchId: targetBranchId,
    });
  } catch (error) {
    console.error("Error in getProducts:", error);
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public (Branch-based)
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name slug")
      .populate("branchId", "name address")
      .populate("selectedItems", "name price category");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`,
      });
    }

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAuthenticated = !!req.user;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    // Handle branch verification based on user type
    if (isAdmin) {
      // Admin users: Check if product belongs to their branch
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`,
        });
      }

      if (product.branchId._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Product not found in your branch",
        });
      }
    } else {
      // Regular users and guests: Check branch from query parameter
      const requestedBranchId = req.query.branchId;

      if (!requestedBranchId) {
        return res.status(400).json({
          success: false,
          message: "Branch ID is required. Please select a branch.",
        });
      }

      // Check if product belongs to the requested branch
      if (product.branchId._id.toString() !== requestedBranchId) {
        return res.status(403).json({
          success: false,
          message: "Product not found in the selected branch",
        });
      }
    }

    // Get product attributes for the product
    const productAttributes = await Attribute.find({
      branchId: product.branchId,
    });
    const productAttributeItems = await ProductAttributeItem.find({
      productId: product._id,
      isActive: true,
    }).populate("attributeId");

    // Group attribute items by product
    const productAttributesMap = {};
    productAttributeItems.forEach((item) => {
      if (!productAttributesMap[product._id]) {
        productAttributesMap[product._id] = [];
      }
      productAttributesMap[product._id].push(item);
    });

    // Transform product data to match frontend structure
    const transformedProduct = {
      id: product._id,
      name: product.name,
      price: product.price,
      currentEffectivePrice: product.currentEffectivePrice || product.price,
      hasActivePriceChanges: product.hasActivePriceChanges || false,
      activePriceChangeId: product.activePriceChangeId || null,
      attributes: productAttributes
        .map((attr) => ({
          id: attr._id,
          name: attr.name,
          type: attr.type,
          requiresSelection: attr.requiresSelection,
          description: attr.description,
          choices: (productAttributesMap[product._id] || [])
            .filter(
              (item) => item.attributeId._id.toString() === attr._id.toString()
            )
            .map((item) => ({
              id: item._id,
              name: item.name,
              price: item.price,
            })),
        }))
        .filter((attr) => attr.choices.length > 0),
      hideItem: product.hideItem ?? false,
      delivery: product.delivery !== undefined ? product.delivery : true,
      collection: product.collection !== undefined ? product.collection : true,
      dineIn: product.dineIn !== undefined ? product.dineIn : true,
      description: product.description,
      weight: product.weight,
      calorificValue: product.calorificValue,
      calorieDetails: product.calorieDetails,
      images: product.images || [],
      availability: product.availability || {},
      allergens: product.allergens || { contains: [], mayContain: [] },
      priceChanges: product.priceChanges || [],
      selectedItems: product.selectedItems?.map((item) => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false,
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || "",
      cssClass: product.cssClass || "",
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      allowAddWithoutChoices: product.allowAddWithoutChoices || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date(),
      },
    };

    res.status(200).json({
      success: true,
      data: transformedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin/Manager/Staff)
exports.createProduct = async (req, res, next) => {
  try {
    // Get user role from roleId
    const userRole = req.user ? req.user.role : null;

    // Set branchId from authenticated user if not provided
    if (
      !req.body.branchId &&
      (userRole === "manager" || userRole === "staff" || userRole === "admin")
    ) {
      req.body.branchId = req.user.branchId;
    }

    // Verify branch exists
    if (req.body.branchId) {
      const branch = await Branch.findById(req.body.branchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Branch not found",
        });
      }

      // For manager/staff/admin, ensure they're creating for their branch
      if (
        (userRole === "manager" ||
          userRole === "staff" ||
          userRole === "admin") &&
        req.body.branchId.toString() !== req.user.branchId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to create products for other branches",
        });
      }
    }

    // Validate category exists
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Handle image uploads if present
    if (req.files && req.files.length > 0) {
      const imagePaths = await saveMultipleFiles(req.files, "products");
      // Store only the relative paths without BACKEND_URL
      req.body.images = imagePaths;
    }

    // Parse JSON strings if they exist
    if (typeof req.body.availability === "string") {
      req.body.availability = JSON.parse(req.body.availability);
    }
    if (typeof req.body.allergens === "string") {
      req.body.allergens = JSON.parse(req.body.allergens);
    }
    if (typeof req.body.priceChanges === "string") {
      req.body.priceChanges = JSON.parse(req.body.priceChanges);
    }
    if (typeof req.body.selectedItems === "string") {
      req.body.selectedItems = JSON.parse(req.body.selectedItems);
    }
    if (typeof req.body.itemSettings === "string") {
      req.body.itemSettings = JSON.parse(req.body.itemSettings);
    }

    // Transform availability data to match schema
    if (req.body.availability) {
      const transformedAvailability = {};
      const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];

      days.forEach((day) => {
        if (req.body.availability[day]) {
          transformedAvailability[day] = {
            isAvailable: req.body.availability[day].isAvailable ?? true,
            type: req.body.availability[day].type || "All Day",
            times: req.body.availability[day].times || [],
          };
        }
      });

      req.body.availability = transformedAvailability;
    }

    // Convert string boolean values to actual booleans
    const booleanFields = [
      "hideItem",
      "delivery",
      "collection",
      "dineIn",
      "freeDelivery",
      "collectionOnly",
      "deleted",
      "hidePrice",
      "allowAddWithoutChoices",
    ];
    booleanFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        req.body[field] =
          req.body[field] === "true" || req.body[field] === true;
      }
    });

    const product = await Product.create(req.body);

    // Fetch the populated product to return
    const populatedProduct = await Product.findById(product._id)
      .populate("category", "name slug")
      .populate("branchId", "name address")
      .populate("selectedItems", "name price category");

    // Transform product data to match frontend structure
    const transformedProduct = {
      id: populatedProduct._id,
      name: populatedProduct.name,
      price: populatedProduct.price,
      // currentEffectivePrice:
      //   populatedProduct.currentEffectivePrice || populatedProduct.price,
      // hasActivePriceChanges: populatedProduct.hasActivePriceChanges || false,
      // activePriceChangeId: populatedProduct.activePriceChangeId || null,
      hideItem: populatedProduct.hideItem ?? false,
      delivery:
        populatedProduct.delivery !== undefined
          ? populatedProduct.delivery
          : true,
      collection:
        populatedProduct.collection !== undefined
          ? populatedProduct.collection
          : true,
      dineIn:
        populatedProduct.dineIn !== undefined ? populatedProduct.dineIn : true,
      description: populatedProduct.description,
      weight: populatedProduct.weight,
      calorificValue: populatedProduct.calorificValue,
      calorieDetails: populatedProduct.calorieDetails,
      images: populatedProduct.images || [],
      availability: populatedProduct.availability || {},
      allergens: populatedProduct.allergens || { contains: [], mayContain: [] },
      priceChanges: populatedProduct.priceChanges || [],
      selectedItems:
        populatedProduct.selectedItems?.map((item) => item._id) || [],
      itemSettings: populatedProduct.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false,
      },
      category: populatedProduct.category,
      branch: populatedProduct.branchId,
      tillProviderProductId: populatedProduct.tillProviderProductId || "",
      cssClass: populatedProduct.cssClass || "",
      freeDelivery: populatedProduct.freeDelivery || false,
      collectionOnly: populatedProduct.collectionOnly || false,
      deleted: populatedProduct.deleted || false,
      hidePrice: populatedProduct.hidePrice || false,
      allowAddWithoutChoices: populatedProduct.allowAddWithoutChoices || false,
      stockManagement: populatedProduct.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date(),
      },
    };

    res.status(201).json({
      success: true,
      data: transformedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin/Manager/Staff)
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`,
      });
    }

    // Get user role from roleId
    const userRole = req.user ? req.user.role : null;

    // For manager/staff/admin, check if product belongs to their branch
    if (
      (userRole === "manager" ||
        userRole === "staff" ||
        userRole === "admin") &&
      product.branchId &&
      req.user.branchId &&
      product.branchId.toString() !== req.user.branchId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update products from other branches",
      });
    }

    // Validate branch exists
    if (req.body.branchId) {
      const branch = await Branch.findById(req.body.branchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: "Branch not found",
        });
      }

      // For manager/staff/admin, ensure they're not changing to other branch
      if (
        (userRole === "manager" ||
          userRole === "staff" ||
          userRole === "admin") &&
        req.body.branchId.toString() !== req.user.branchId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to move products to other branches",
        });
      }
    }

    // Validate category exists
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Handle image uploads if present
    if (req.files && req.files.length > 0) {
      // Delete old images
      if (product.images && product.images.length > 0) {
        for (const imagePath of product.images) {
          await deleteFile(imagePath);
        }
      }

      // Save new images
      const imagePaths = await saveMultipleFiles(req.files, "products");
      // Store only the relative paths without BACKEND_URL
      req.body.images = imagePaths;
    }

    // Parse JSON strings if they exist
    if (typeof req.body.availability === "string") {
      req.body.availability = JSON.parse(req.body.availability);
    }
    if (typeof req.body.allergens === "string") {
      req.body.allergens = JSON.parse(req.body.allergens);
    }
    if (typeof req.body.priceChanges === "string") {
      req.body.priceChanges = JSON.parse(req.body.priceChanges);
    }
    if (typeof req.body.selectedItems === "string") {
      req.body.selectedItems = JSON.parse(req.body.selectedItems);
    }
    if (typeof req.body.itemSettings === "string") {
      req.body.itemSettings = JSON.parse(req.body.itemSettings);
    }

    // Transform availability data to match schema
    if (req.body.availability) {
      const transformedAvailability = {};
      const days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];

      days.forEach((day) => {
        if (req.body.availability[day]) {
          transformedAvailability[day] = {
            isAvailable: req.body.availability[day].isAvailable ?? true,
            type: req.body.availability[day].type || "All Day",
            times: req.body.availability[day].times || [],
          };
        }
      });

      req.body.availability = transformedAvailability;
    }

    // Convert string boolean values to actual booleans
    const booleanFields = [
      "hideItem",
      "delivery",
      "collection",
      "dineIn",
      "freeDelivery",
      "collectionOnly",
      "deleted",
      "hidePrice",
      "allowAddWithoutChoices",
    ];
    booleanFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        req.body[field] =
          req.body[field] === "true" || req.body[field] === true;
      }
    });

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("category", "name slug")
      .populate("branchId", "name address")
      .populate("selectedItems", "name price category");

    // Transform product data to match frontend structure
    const transformedProduct = {
      id: product._id,
      name: product.name,
      price: product.price,
      // currentEffectivePrice: product.currentEffectivePrice || product.price,
      // hasActivePriceChanges: product.hasActivePriceChanges || false,
      // activePriceChangeId: product.activePriceChangeId || null,
      hideItem: product.hideItem ?? false,
      delivery: product.delivery !== undefined ? product.delivery : true,
      collection: product.collection !== undefined ? product.collection : true,
      dineIn: product.dineIn !== undefined ? product.dineIn : true,
      description: product.description,
      weight: product.weight,
      calorificValue: product.calorificValue,
      calorieDetails: product.calorieDetails,
      images: product.images || [],
      availability: product.availability || {},
      allergens: product.allergens || { contains: [], mayContain: [] },
      priceChanges: product.priceChanges || [],
      selectedItems: product.selectedItems?.map((item) => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false,
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || "",
      cssClass: product.cssClass || "",
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      allowAddWithoutChoices: product.allowAddWithoutChoices || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date(),
      },
    };

    res.status(200).json({
      success: true,
      data: transformedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Public
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`,
      });
    }

    // Delete associated images
    if (product.images && product.images.length > 0) {
      for (const imagePath of product.images) {
        await deleteFile(imagePath);
      }
    }

    await Product.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get popular products
// @route   GET /api/products/popular
// @access  Public
exports.getPopularProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isPopular: true })
      .populate("category", "name")
      .populate("branchId", "name address")
      .populate("selectedItems", "name price category")
      .populate({
        path: "priceChanges",
        match: {
          active: true,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        },
      })
      .limit(8);

    // Transform products to match frontend structure
    const transformedProducts = products.map((product) => ({
      id: product._id,
      name: product.name,
      price: product.price,
      // currentEffectivePrice: product.currentEffectivePrice || product.price,
      // hasActivePriceChanges: product.hasActivePriceChanges || false,
      // activePriceChangeId: product.activePriceChangeId || null,
      hideItem: product.hideItem ?? false,
      delivery: product.delivery !== undefined ? product.delivery : true,
      collection: product.collection !== undefined ? product.collection : true,
      dineIn: product.dineIn !== undefined ? product.dineIn : true,
      description: product.description,
      weight: product.weight,
      calorificValue: product.calorificValue,
      calorieDetails: product.calorieDetails,
      images: product.images || [],
      availability: product.availability || {},
      allergens: product.allergens || { contains: [], mayContain: [] },
      priceChanges: product.priceChanges || [],
      selectedItems: product.selectedItems?.map((item) => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false,
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || "",
      cssClass: product.cssClass || "",
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      allowAddWithoutChoices: product.allowAddWithoutChoices || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date(),
      },
    }));

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      data: transformedProducts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recommended products
// @route   GET /api/products/recommended
// @access  Public
exports.getRecommendedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isRecommended: true })
      .populate("category", "name")
      .populate("branchId", "name address")
      .populate("selectedItems", "name price category")
      .limit(8);

    // Transform products to match frontend structure
    const transformedProducts = products.map((product) => ({
      id: product._id,
      name: product.name,
      price: product.price,
      // currentEffectivePrice: product.currentEffectivePrice || product.price,
      // hasActivePriceChanges: product.hasActivePriceChanges || false,
      // activePriceChangeId: product.activePriceChangeId || null,
      hideItem: product.hideItem ?? false,
      delivery: product.delivery !== undefined ? product.delivery : true,
      collection: product.collection !== undefined ? product.collection : true,
      dineIn: product.dineIn !== undefined ? product.dineIn : true,
      description: product.description,
      weight: product.weight,
      calorificValue: product.calorificValue,
      calorieDetails: product.calorieDetails,
      images: product.images || [],
      availability: product.availability || {},
      allergens: product.allergens || { contains: [], mayContain: [] },
      priceChanges: product.priceChanges || [],
      selectedItems: product.selectedItems?.map((item) => item._id) || [],
      itemSettings: product.itemSettings || {
        showSelectedOnly: false,
        showSelectedCategories: false,
        limitSingleChoice: false,
        addAttributeCharges: false,
        useProductPrices: false,
        showChoiceAsDropdown: false,
      },
      category: product.category,
      branch: product.branchId,
      tillProviderProductId: product.tillProviderProductId || "",
      cssClass: product.cssClass || "",
      freeDelivery: product.freeDelivery || false,
      collectionOnly: product.collectionOnly || false,
      deleted: product.deleted || false,
      hidePrice: product.hidePrice || false,
      allowAddWithoutChoices: product.allowAddWithoutChoices || false,
      stockManagement: product.stockManagement || {
        isManaged: false,
        quantity: 0,
        lowStockThreshold: 10,
        lastUpdated: new Date(),
      },
    }));

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      data: transformedProducts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update stock for multiple products
// @route   PUT /api/products/stock/bulk-update
// @access  Public
exports.bulkUpdateStock = async (req, res, next) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required",
      });
    }

    const updateResults = [];
    const errors = [];

    // Process each product update
    for (const productUpdate of products) {
      try {
        const { id, isManaged, quantity } = productUpdate;

        if (!id) {
          errors.push({ productId: null, error: "Product ID is required" });
          continue;
        }

        // Validate quantity if provided
        if (
          quantity !== undefined &&
          (quantity < 0 || !Number.isInteger(quantity))
        ) {
          errors.push({
            productId: id,
            error: "Quantity must be a non-negative integer",
          });
          continue;
        }

        // Find and update the product
        const product = await Product.findById(id);
        if (!product) {
          errors.push({ productId: id, error: "Product not found" });
          continue;
        }

        // Prepare stock management update
        const stockUpdate = {
          "stockManagement.lastUpdated": new Date(),
        };

        if (isManaged !== undefined) {
          stockUpdate["stockManagement.isManaged"] = isManaged;
        }

        if (quantity !== undefined) {
          stockUpdate["stockManagement.quantity"] = quantity;
        }

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
          id,
          stockUpdate,
          { new: true, runValidators: true }
        );

        updateResults.push({
          productId: id,
          name: updatedProduct.name,
          stockManagement: updatedProduct.stockManagement,
          success: true,
        });
      } catch (error) {
        errors.push({
          productId: productUpdate.id || "unknown",
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Stock updated successfully`,
      data: {
        updated: updateResults,
        errors: errors,
        totalProcessed: products.length,
        successCount: updateResults.length,
        errorCount: errors.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock status for all managed products
// @route   GET /api/products/stock/status
// @access  Public
exports.getStockStatus = async (req, res, next) => {
  try {
    let query = { "stockManagement.isManaged": true };

    // Filter by branch if provided
    if (req.query.branchId) {
      query.branchId = req.query.branchId;
    }

    // Filter by category if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by low stock if requested
    if (req.query.lowStock === "true") {
      query.$expr = {
        $lte: [
          "$stockManagement.quantity",
          "$stockManagement.lowStockThreshold",
        ],
      };
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("branchId", "name")
      .select("name stockManagement category branchId")
      .sort("name");

    // Transform data for response
    const stockStatus = products.map((product) => ({
      id: product._id,
      name: product.name,
      category: product.category,
      branch: product.branchId,
      stockManagement: product.stockManagement,
      isLowStock:
        product.stockManagement.quantity <=
        product.stockManagement.lowStockThreshold,
    }));

    res.status(200).json({
      success: true,
      count: stockStatus.length,
      data: stockStatus,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get offline products for admin's branch
// @route   GET /api/products/offline
// @access  Private (Admin/Manager/Staff)
exports.getOfflineProducts = async (req, res, next) => {
  try {
    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can access offline products",
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    let query = { branchId: req.user.branchId };

    // Search functionality
    if (req.query.searchText) {
      query.name = { $regex: req.query.searchText, $options: "i" };
    }

    // Filter by category if provided
    if (req.query.category) {
      query.category = req.query.category;
    }

    const products = await Product.find(query)
      .populate("category", "name slug")
      .populate("branchId", "name address")
      .sort("name");

    // Transform products to match frontend structure
    const transformedProducts = products.map((product) => ({
      id: product._id,
      name: product.name,
      price: product.price,
      // currentEffectivePrice: product.currentEffectivePrice || product.price,
      // hasActivePriceChanges: product.hasActivePriceChanges || false,
      // activePriceChangeId: product.activePriceChangeId || null,
      hideItem: product.hideItem ?? false,
      delivery: product.delivery !== undefined ? product.delivery : true,
      collection: product.collection !== undefined ? product.collection : true,
      dineIn: product.dineIn !== undefined ? product.dineIn : true,
      description: product.description,
      category: product.category,
      isOffline: product.hideItem ?? false, // hideItem represents offline status
    }));

    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      data: transformedProducts,
      branchId: req.user.branchId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle product offline status
// @route   PATCH /api/products/:id/toggle-offline
// @access  Private (Admin/Manager/Staff)
exports.toggleProductOffline = async (req, res, next) => {
  try {
    const { isOffline } = req.body;

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can toggle product offline status",
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with id of ${req.params.id}`,
      });
    }

    // Check if product belongs to admin's branch
    if (product.branchId.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update products from other branches",
      });
    }

    // Update hideItem field (which represents offline status)
    product = await Product.findByIdAndUpdate(
      req.params.id,
      { hideItem: isOffline },
      { new: true, runValidators: true }
    )
      .populate("category", "name slug")
      .populate("branchId", "name address");

    // Transform product data to match frontend structure
    const transformedProduct = {
      id: product._id,
      name: product.name,
      price: product.price,
      // currentEffectivePrice: product.currentEffectivePrice || product.price,
      // hasActivePriceChanges: product.hasActivePriceChanges || false,
      // activePriceChangeId: product.activePriceChangeId || null,
      hideItem: product.hideItem ?? false,
      delivery: product.delivery !== undefined ? product.delivery : true,
      collection: product.collection !== undefined ? product.collection : true,
      dineIn: product.dineIn !== undefined ? product.dineIn : true,
      description: product.description,
      category: product.category,
      isOffline: product.hideItem ?? false,
    };

    res.status(200).json({
      success: true,
      data: transformedProduct,
      message: `Product ${
        isOffline ? "taken offline" : "brought online"
      } successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle all products offline status
// @route   PATCH /api/products/toggle-all-offline
// @access  Private (Admin/Manager/Staff)
exports.toggleAllProductsOffline = async (req, res, next) => {
  try {
    const { isOffline } = req.body;

    // Determine user role and authentication status
    const userRole = req.user ? req.user.role : null;
    const isAdmin = userRole && MANAGEMENT_ROLES.includes(userRole);

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin users can toggle all products offline status",
      });
    }

    // Admin users: Use their assigned branchId
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`,
      });
    }

    // Update all products for the admin's branch
    const result = await Product.updateMany(
      { branchId: req.user.branchId },
      { hideItem: isOffline }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} products ${
        isOffline ? "taken offline" : "brought online"
      } successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

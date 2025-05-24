const Branch = require('../models/branch.model');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Public (for branch selection)
exports.getBranches = async (req, res, next) => {
  try {
    // For public access, only show active branches
    let query = { isActive: true };
    
    // Optional: Allow filtering by location/region if needed
    if (req.query.region) {
      query['address.state'] = req.query.region;
    }
    
    if (req.query.city) {
      query['address.city'] = { $regex: req.query.city, $options: 'i' };
      }

    const branches = await Branch.find(query)
      .select('name address contact location isActive isDefault') // Only return essential fields
      .sort('name');

    res.status(200).json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single branch (admin's assigned branch)
// @route   GET /api/branches/my-branch
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.getBranch = async (req, res, next) => {
  try {
    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Get the admin's assigned branch
    const branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }

    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new branch
// @route   POST /api/branches
// @access  Private (Admin/Manager/Staff with branch verification)
exports.createBranch = async (req, res, next) => {
  try {
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Allow admin, manager, and staff to create branches
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can create branches'
      });
    }
    
    // User must be assigned to a branch (for audit purposes)
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    const branch = await Branch.create(req.body);

    res.status(201).json({
      success: true,
      data: branch,
      message: 'Branch created successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update branch (admin's assigned branch)
// @route   PUT /api/branches/my-branch
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.updateBranch = async (req, res, next) => {
  try {
    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;

    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Allow admin, manager, and staff to update branches
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can update branches'
      });
    }
    
    // Get the user's assigned branch
    let branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
          success: false,
        message: 'Your assigned branch not found'
        });
      }
      
    // For manager and staff, restrict certain fields
    if (userRole === 'manager' || userRole === 'staff') {
      // Managers and staff cannot change critical branch properties like isActive
      const restrictedFields = ['isActive', 'isDefault'];
      for (const field of restrictedFields) {
        if (req.body[field] !== undefined && req.body[field] !== branch[field]) {
          return res.status(403).json({
            success: false,
            message: `${userRole} cannot modify the ${field} property`
          });
        }
      }
    }

    // Update the branch
    branch = await Branch.findByIdAndUpdate(req.user.branchId, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: branch,
      message: 'Branch updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete branch (admin's assigned branch)
// @route   DELETE /api/branches/my-branch
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.deleteBranch = async (req, res, next) => {
  try {
    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;

    // Allow admin, manager, and staff to delete branches
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can delete branches'
      });
    }
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    // Get the user's assigned branch
    const branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }
    
    // Prevent deletion if branch is default
    if (branch.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default branch'
      });
    }
    
    // Check if branch has associated products, categories, or staff
    const Product = require('../models/product.model');
    const Category = require('../models/category.model');
    const User = require('../models/user.model');
    
    const products = await Product.countDocuments({ branchId: req.user.branchId });
    if (products > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${products} associated products`
      });
    }
    
    const categories = await Category.countDocuments({ branchId: req.user.branchId });
    if (categories > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${categories} associated categories`
      });
    }
    
    const users = await User.countDocuments({ branchId: req.user.branchId });
    if (users > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${users} associated staff/managers`
      });
    }

    await branch.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get branches within radius
// @route   GET /api/branches/radius/:zipcode/:distance
// @access  Public
exports.getBranchesInRadius = async (req, res, next) => {
  try {
    const { zipcode, distance } = req.params;

    // Get lat/lng from geocoder
    const loc = await geocodeAddress(zipcode);
    const lat = loc.latitude;
    const lng = loc.longitude;

    // Calc radius using radians
    // Divide dist by radius of Earth
    // Earth Radius = 3,963 mi / 6,378 km
    const radius = distance / 3963;

    const branches = await Branch.find({
      location: {
        $geoWithin: { $centerSphere: [[lng, lat], radius] }
      }
    });

    res.status(200).json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update branch settings (admin's assigned branch)
// @route   PATCH /api/branches/settings
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.updateBranchSettings = async (req, res, next) => {
  try {
    const { isCollectionEnabled, isDeliveryEnabled, isTableOrderingEnabled } = req.body;

    // Validate at least one setting is provided
    if (isCollectionEnabled === undefined && 
        isDeliveryEnabled === undefined && 
        isTableOrderingEnabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one setting to update'
      });
    }

    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Allow admin, manager, and staff to update branch settings
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can update branch settings'
      });
    }
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    // Get the user's assigned branch
    let branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }

    // Build settings object with only the provided settings
    const updateSettings = {};
    
    if (isCollectionEnabled !== undefined) {
      updateSettings.isCollectionEnabled = isCollectionEnabled;
    }
    
    if (isDeliveryEnabled !== undefined) {
      updateSettings.isDeliveryEnabled = isDeliveryEnabled;
    }
    
    if (isTableOrderingEnabled !== undefined) {
      updateSettings.isTableOrderingEnabled = isTableOrderingEnabled;
    }

    // Update only the settings fields
    branch = await Branch.findByIdAndUpdate(
      req.user.branchId, 
      { $set: updateSettings },
      { new: true, runValidators: true }
    ).populate('manager', 'name email');

    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to geocode an address
// This is a placeholder - in a real app, you'd use a geocoding service
const geocodeAddress = async (zipcode) => {
  // Placeholder implementation
  return {
    latitude: 0,
    longitude: 0
  };
};

// @desc    Get outlet settings (admin's assigned branch)
// @route   GET /api/branches/outlet-settings
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.getOutletSettings = async (req, res, next) => {
  try {
    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }

    // Get the admin's assigned branch
    const branch = await Branch.findById(req.user.branchId).populate('manager', 'name email');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }

    // Transform data to match frontend format
    const outletSettings = {
      id: branch._id,
      name: branch.name,
      aboutUs: branch.aboutUs || '',
      email: branch.contact.email,
      contactNumber: branch.contact.phone,
      telephone: branch.contact.telephone || '',
      address: {
        street: branch.address.street,
        addressLine2: branch.address.addressLine2 || '',
        city: branch.address.city,
        county: branch.address.county || '',
        state: branch.address.state,
        postcode: branch.address.postalCode,
        country: branch.address.country
      },
      openingTimes: branch.openingTimes || {},
      orderingOptions: {
        collection: {
          displayFormat: branch.orderingOptions?.collection?.displayFormat || 'TimeOnly',
          timeslotLength: branch.orderingOptions?.collection?.timeslotLength || 15
        },
        delivery: {
          displayFormat: branch.orderingOptions?.delivery?.displayFormat || 'TimeOnly',
          timeslotLength: branch.orderingOptions?.delivery?.timeslotLength || 15
        }
      },
      preOrdering: {
        allowCollectionPreOrders: branch.preOrdering?.allowCollectionPreOrders || false,
        allowDeliveryPreOrders: branch.preOrdering?.allowDeliveryPreOrders || false
      }
    };

    res.status(200).json({
      success: true,
      data: outletSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update outlet details (admin's assigned branch)
// @route   PUT /api/branches/outlet-details
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.updateOutletDetails = async (req, res, next) => {
  try {
    const { name, aboutUs, email, contactNumber, telephone } = req.body;

    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Allow admin, manager, and staff to update outlet details
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can update outlet details'
      });
    }

    // Get the user's assigned branch
    let branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }

    // Prepare update object
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (aboutUs !== undefined) updateData.aboutUs = aboutUs;
    if (email !== undefined) updateData['contact.email'] = email;
    if (contactNumber !== undefined) updateData['contact.phone'] = contactNumber;
    if (telephone !== undefined) updateData['contact.telephone'] = telephone;

    branch = await Branch.findByIdAndUpdate(
      req.user.branchId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Outlet details updated successfully',
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update outlet location (admin's assigned branch)
// @route   PUT /api/branches/outlet-location
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.updateOutletLocation = async (req, res, next) => {
  try {
    const { street, addressLine2, city, county, state, postcode, country } = req.body;

    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Allow admin, manager, and staff to update location
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can update outlet location'
      });
    }

    // Get the user's assigned branch
    let branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }

    // Prepare update object
    const updateData = {};
    
    if (street !== undefined) updateData['address.street'] = street;
    if (addressLine2 !== undefined) updateData['address.addressLine2'] = addressLine2;
    if (city !== undefined) updateData['address.city'] = city;
    if (county !== undefined) updateData['address.county'] = county;
    if (state !== undefined) updateData['address.state'] = state;
    if (postcode !== undefined) updateData['address.postalCode'] = postcode;
    if (country !== undefined) updateData['address.country'] = country;

    branch = await Branch.findByIdAndUpdate(
      req.user.branchId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Outlet location updated successfully',
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update outlet ordering options (admin's assigned branch)
// @route   PUT /api/branches/outlet-ordering-options
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.updateOutletOrderingOptions = async (req, res, next) => {
  try {
    const { collection, delivery } = req.body;

    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Allow admin, manager, and staff to update ordering options
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can update ordering options'
      });
    }

    // Get the user's assigned branch
    let branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }

    // Prepare update object
    const updateData = {};
    
    if (collection) {
      if (collection.displayFormat !== undefined) {
        updateData['orderingOptions.collection.displayFormat'] = collection.displayFormat;
      }
      if (collection.timeslotLength !== undefined) {
        updateData['orderingOptions.collection.timeslotLength'] = collection.timeslotLength;
      }
    }
    
    if (delivery) {
      if (delivery.displayFormat !== undefined) {
        updateData['orderingOptions.delivery.displayFormat'] = delivery.displayFormat;
      }
      if (delivery.timeslotLength !== undefined) {
        updateData['orderingOptions.delivery.timeslotLength'] = delivery.timeslotLength;
      }
    }

    branch = await Branch.findByIdAndUpdate(
      req.user.branchId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Outlet ordering options updated successfully',
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update outlet pre-ordering settings (admin's assigned branch)
// @route   PUT /api/branches/outlet-pre-ordering
// @access  Private (Admin/Manager/Staff - their assigned branch)
exports.updateOutletPreOrdering = async (req, res, next) => {
  try {
    const { allowCollectionPreOrders, allowDeliveryPreOrders } = req.body;

    // Get user role and branch from authenticated user
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Ensure user has branch assignment
    if (!req.user.branchId) {
      return res.status(400).json({
        success: false,
        message: `${userRole} must be assigned to a branch`
      });
    }
    
    // Allow admin, manager, and staff to update pre-ordering settings
    if (!['admin', 'manager', 'staff'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admin, manager, or staff users can update pre-ordering settings'
      });
    }

    // Get the user's assigned branch
    let branch = await Branch.findById(req.user.branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Your assigned branch not found'
      });
    }

    // Prepare update object
    const updateData = {};
    
    if (allowCollectionPreOrders !== undefined) {
      updateData['preOrdering.allowCollectionPreOrders'] = allowCollectionPreOrders;
    }
    
    if (allowDeliveryPreOrders !== undefined) {
      updateData['preOrdering.allowDeliveryPreOrders'] = allowDeliveryPreOrders;
    }

    branch = await Branch.findByIdAndUpdate(
      req.user.branchId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Outlet pre-ordering settings updated successfully',
      data: branch
    });
  } catch (error) {
    next(error);
  }
}; 
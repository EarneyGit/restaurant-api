const Branch = require('../models/branch.model');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Public (with role-based filtering)
exports.getBranches = async (req, res, next) => {
  try {
    let query = { isActive: true };
    
    // For public access, we only show active branches
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, only show their branch
    if (userRole === 'manager' || userRole === 'staff') {
      if (!req.user.branchId) {
        return res.status(400).json({
          success: false,
          message: `${userRole} must be assigned to a branch`
        });
      }
      query._id = req.user.branchId;
    }
    
    // For admin, show all branches (including inactive if queried)
    if (userRole === 'admin' && req.query.showAll === 'true') {
      delete query.isActive;
    }

    const branches = await Branch.find(query);

    res.status(200).json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Public (with role-based control)
exports.getBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branch._id.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this branch'
      });
    }
    
    // For regular users, only show active branches
    if (!userRole && !branch.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
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
// @access  Private/Admin
exports.createBranch = async (req, res, next) => {
  try {
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Only admin can create branches
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create branches'
      });
    }

    const branch = await Branch.create(req.body);

    res.status(201).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update branch
// @route   PUT /api/branches/:id
// @access  Private/Admin/Manager
exports.updateBranch = async (req, res, next) => {
  try {
    let branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update branches
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update branches'
      });
    }
    
    // For manager, allow updates only to their branch, and restrict certain fields
    if (userRole === 'manager') {
      if (branch._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other branches'
        });
      }
      
      // Managers cannot change critical branch properties like isActive
      const restrictedFields = ['isActive', 'isDefault'];
      for (const field of restrictedFields) {
        if (req.body[field] !== undefined && req.body[field] !== branch[field]) {
          return res.status(403).json({
            success: false,
            message: `Managers cannot modify the ${field} property`
          });
        }
      }
    }

    branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete branch
// @route   DELETE /api/branches/:id
// @access  Private/Admin
exports.deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }
    
    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Only admin can delete branches
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete branches'
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
    
    const products = await Product.countDocuments({ branchId: req.params.id });
    if (products > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${products} associated products`
      });
    }
    
    const categories = await Category.countDocuments({ branchId: req.params.id });
    if (categories > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${categories} associated categories`
      });
    }
    
    const users = await User.countDocuments({ branchId: req.params.id });
    if (users > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch with ${users} associated staff/managers`
      });
    }

    await branch.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
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

// @desc    Update branch settings
// @route   PATCH /api/branches/:id/settings
// @access  Private/Admin
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

    let branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
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
      req.params.id, 
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

// @desc    Get outlet settings
// @route   GET /api/branches/:id/outlet-settings
// @access  Private/Admin/Manager
exports.getOutletSettings = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id).populate('manager', 'name email');

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // For manager/staff, only allow access to their branch
    if ((userRole === 'manager' || userRole === 'staff') && 
        req.user.branchId && 
        branch._id.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this branch settings'
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

// @desc    Update outlet details
// @route   PUT /api/branches/:id/outlet-details
// @access  Private/Admin/Manager
exports.updateOutletDetails = async (req, res, next) => {
  try {
    const { name, aboutUs, email, contactNumber, telephone } = req.body;

    let branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update outlet details
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update outlet details'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branch._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other branch details'
        });
      }
    }

    // Prepare update object
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (aboutUs !== undefined) updateData.aboutUs = aboutUs;
    if (email !== undefined) updateData['contact.email'] = email;
    if (contactNumber !== undefined) updateData['contact.phone'] = contactNumber;
    if (telephone !== undefined) updateData['contact.telephone'] = telephone;

    branch = await Branch.findByIdAndUpdate(
      req.params.id,
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

// @desc    Update outlet location
// @route   PUT /api/branches/:id/outlet-location
// @access  Private/Admin/Manager
exports.updateOutletLocation = async (req, res, next) => {
  try {
    const { street, addressLine2, city, county, state, postcode, country } = req.body;

    let branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update location
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update outlet location'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branch._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other branch location'
        });
      }
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
      req.params.id,
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

// @desc    Update outlet ordering options
// @route   PUT /api/branches/:id/outlet-ordering-options
// @access  Private/Admin/Manager
exports.updateOutletOrderingOptions = async (req, res, next) => {
  try {
    const { collection, delivery } = req.body;

    let branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update ordering options
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update ordering options'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branch._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other branch ordering options'
        });
      }
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
      req.params.id,
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

// @desc    Update outlet pre-ordering settings
// @route   PUT /api/branches/:id/outlet-pre-ordering
// @access  Private/Admin/Manager
exports.updateOutletPreOrdering = async (req, res, next) => {
  try {
    const { allowCollectionPreOrders, allowDeliveryPreOrders } = req.body;

    let branch = await Branch.findById(req.params.id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch not found with id of ${req.params.id}`
      });
    }

    // Get user role from roleId
    const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;
    
    // Staff cannot update pre-ordering settings
    if (userRole === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff are not authorized to update pre-ordering settings'
      });
    }
    
    // For manager, allow updates only to their branch
    if (userRole === 'manager') {
      if (branch._id.toString() !== req.user.branchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other branch pre-ordering settings'
        });
      }
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
      req.params.id,
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
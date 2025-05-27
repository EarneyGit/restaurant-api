const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_api_secret_key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    phone: {
      type: String,
      maxlength: [20, 'Phone number cannot be longer than 20 characters']
    },
    address: {
      type: String,
      maxlength: [200, 'Address cannot be more than 200 characters']
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role'
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationOtp: String,
    emailVerificationOtpExpire: Date,
    passwordResetOtp: String,
    passwordResetOtpExpire: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  // Only run this function if password was modified
  if (!this.isModified('password')) {
    return next();
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Validate branch assignment for staff and manager roles
userSchema.pre('save', async function(next) {
  try {
    // Skip validation if roleId not changed or not set
    if (!this.isModified('roleId') && !this.isNew) {
      return next();
    }
    
    // Verify role exists
    if (this.roleId) {
      const Role = mongoose.model('Role');
      const role = await Role.findById(this.roleId);
      
      if (!role) {
        throw new Error('Invalid role');
      }
      
      // For staff and manager roles, branch is required
      // SuperAdmin and Admin don't require branch assignment
      if (['staff', 'manager'].includes(role.slug) && !this.branchId) {
        throw new Error(`Branch assignment is required for ${role.name} role`);
      }
      
      // For manager role, check if branch already has a manager
      if (role.slug === 'manager' && this.branchId) {
        const User = this.constructor;
        const existingManager = await User.findOne({
          _id: { $ne: this._id }, // Exclude current user
          roleId: this.roleId,
          branchId: this.branchId,
          isActive: true
        });
        
        if (existingManager) {
          throw new Error('Branch already has an active manager');
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = async function() {
  // Get role information to include in token
  let role = null;
  let branchId = null;
  
  if (this.roleId) {
    const Role = mongoose.model('Role');
    const roleDoc = await Role.findById(this.roleId);
    if (roleDoc) {
      role = roleDoc.slug;
    }
  }
  
  if (this.branchId) {
    branchId = this.branchId.toString();
  }
  
  return jwt.sign(
    { 
      id: this._id,
      role,
      branchId
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRE
    }
  );
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user has branch access
userSchema.methods.hasBranchAccess = function(targetBranchId) {
  // SuperAdmin and Admin have access to all branches
  if (['superadmin', 'admin'].includes(this.role)) {
    return true;
  }
  
  // Manager and staff only have access to their assigned branch
  if (['manager', 'staff'].includes(this.role) && this.branchId) {
    return this.branchId.toString() === targetBranchId.toString();
  }
  
  return false;
};

// Track user login
userSchema.methods.trackLogin = async function() {
  this.lastLogin = new Date();
  await this.save({ validateBeforeSave: false });
};

const User = mongoose.model('User', userSchema);

module.exports = User; 
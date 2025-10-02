const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_api_secret_key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot be more than 50 characters']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot be more than 50 characters']
    },
    // name: {
    //   type: String,
    //   trim: true,
    //   maxlength: [100, 'Name cannot be more than 100 characters']
    // },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    password: {
      type: String,
      required: function() {
        // Password is required unless explicitly set to null (for guest users)
        return this.password !== null;
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    mobileNumber: {
      type: String,
      maxlength: [20, 'Phone number cannot be longer than 20 characters']
    },
    addressLine1: {
      type: String,
      maxlength: [100, 'Address line 1 cannot be more than 100 characters']
    },
    addressLine2: {
      type: String,
      maxlength: [100, 'Address line 2 cannot be more than 100 characters']
    },
    city: {
      type: String,
      maxlength: [50, 'City cannot be more than 50 characters']
    },
    postalCode: {
      type: String,
      maxlength: [20, 'Postal code cannot be more than 20 characters']
    },
    emailNotifications: {
      type: Boolean,
      default: false
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    preferredCommunicationEmail: {
      type: Boolean,
      default: false
    },
    preferredCommunicationSMS: {
      type: Boolean,
      default: false
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
    passwordResetOtpExpire: Date,
    // Audit Log Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);


// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  // Only run this function if password was modified and not null
  if (!this.isModified('password') || this.password === null) {
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
  // If the user has a null password (guest user), they can't login with password
  if (this.password === null) {
    return false;
  }
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
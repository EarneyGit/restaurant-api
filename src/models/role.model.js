const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a role name'],
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      required: [true, 'Please add a role slug'],
      enum: ['admin', 'manager', 'staff', 'user', 'superadmin'],
      unique: true
    },
    description: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
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
    timestamps: true
  }
);

// Create default roles if none exist
roleSchema.statics.createDefaultRoles = async function() {
  try {
    const count = await this.countDocuments();
    
    if (count === 0) {
      // Create default roles
      const defaultRoles = [
        {
          name: 'Super Admin',
          slug: 'superadmin',
          description: 'Super administrator with full system access including branch management'
        },
        {
          name: 'Admin',
          slug: 'admin',
          description: 'System administrator with full access to all features'
        },
        {
          name: 'Manager',
          slug: 'manager',
          description: 'Branch manager with access to branch-specific features'
        },
        {
          name: 'Staff',
          slug: 'staff',
          description: 'Branch staff with limited access to operational features'
        },
        {
          name: 'User',
          slug: 'user',
          description: 'Regular user with access to public features'
        }
      ];
      
      await this.insertMany(defaultRoles);
      console.log('Default roles created successfully');
    }
  } catch (error) {
    console.error('Error creating default roles:', error);
  }
};

const Role = mongoose.model('Role', roleSchema);

module.exports = Role; 
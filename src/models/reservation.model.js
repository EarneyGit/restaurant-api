const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    reservationNumber: {
      type: String,
      unique: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Please provide a name']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Please provide a phone number']
    },
    numberOfGuests: {
      type: Number,
      required: [true, 'Please provide the number of guests'],
      min: [1, 'Number of guests must be at least 1']
    },
    reservationDate: {
      type: Date,
      required: [true, 'Please provide a reservation date']
    },
    reservationTime: {
      type: String,
      required: [true, 'Please provide a reservation time']
    },
    specialRequests: {
      type: String
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending'
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    tableNumber: {
      type: String
    },
    occasion: {
      type: String,
      enum: ['birthday', 'anniversary', 'business', 'other'],
      default: 'other'
    }
  },
  {
    timestamps: true
  }
);

// Generate reservation number before saving
reservationSchema.pre('save', async function(next) {
  try {
    // Only generate number for new reservations
    if (this.isNew) {
      const date = new Date();
      const year = date.getFullYear().toString().substr(-2);
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      
      // Get count of reservations for this branch today and increment
      const Reservation = this.constructor;
      const todayStart = new Date(date.setHours(0, 0, 0, 0));
      const todayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const reservationCount = await Reservation.countDocuments({
        branch: this.branch,
        createdAt: {
          $gte: todayStart,
          $lte: todayEnd
        }
      });
      
      // Format: BRANCH-RES-YY-MM-DD-XXX (where XXX is the sequential number)
      const sequentialNumber = ('000' + (reservationCount + 1)).slice(-3);
      this.reservationNumber = `BR${this.branch.toString().substr(-4)}-RES-${year}${month}${day}-${sequentialNumber}`;
    }

    // If staff/manager is assigned, verify they belong to the same branch
    if (this.assignedStaff) {
      const User = mongoose.model('User');
      const staff = await User.findById(this.assignedStaff);
      
      if (!staff) {
        throw new Error('Assigned staff not found');
      }

      if (staff.role !== 'admin' && staff.branchId.toString() !== this.branch.toString()) {
        throw new Error('Staff must belong to the same branch as the reservation');
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware to check branch availability before saving
reservationSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('reservationDate') || this.isModified('reservationTime')) {
      // Check branch operating hours
      const Branch = mongoose.model('Branch');
      const branch = await Branch.findById(this.branch);
      
      if (!branch) {
        throw new Error('Branch not found');
      }

      if (!branch.isActive) {
        throw new Error('Branch is not active');
      }

      // Get day of week from reservation date
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = days[new Date(this.reservationDate).getDay()];

      // Find branch opening hours for this day
      const branchHours = branch.openingHours.find(h => h.day === dayOfWeek);
      
      if (!branchHours || !branchHours.isOpen) {
        throw new Error(`Branch is closed on ${dayOfWeek}`);
      }

      // Check if reservation time is within opening hours
      const [resHour, resMinute] = this.reservationTime.split(':');
      const [openHour, openMinute] = branchHours.openTime.split(':');
      const [closeHour, closeMinute] = branchHours.closeTime.split(':');

      const resTime = parseInt(resHour) * 60 + parseInt(resMinute);
      const openTime = parseInt(openHour) * 60 + parseInt(openMinute);
      const closeTime = parseInt(closeHour) * 60 + parseInt(closeMinute);

      if (resTime < openTime || resTime > closeTime) {
        throw new Error(`Branch is closed at ${this.reservationTime}. Opening hours are ${branchHours.openTime} to ${branchHours.closeTime}`);
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for checking if reservation can be modified by a user
reservationSchema.virtual('canBeModifiedBy').get(function(user) {
  if (!user) return false;
  
  // Admin can modify any reservation
  if (user.role === 'admin') return true;
  
  // Manager can modify reservations in their branch
  if (user.role === 'manager' && user.branchId && user.branchId.toString() === this.branch.toString()) return true;
  
  // Staff can modify reservations they're assigned to in their branch
  if (user.role === 'staff' && 
      user.branchId && 
      user.branchId.toString() === this.branch.toString() && 
      this.assignedStaff && 
      this.assignedStaff.toString() === user._id.toString()) return true;
  
  // Users can only modify their own pending/confirmed reservations
  if (user.role === 'user' && 
      this.user.toString() === user._id.toString() && 
      ['pending', 'confirmed'].includes(this.status)) return true;
  
  return false;
});

const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation; 
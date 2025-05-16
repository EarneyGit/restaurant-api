const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    reservationNumber: {
      type: String,
      required: true,
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
  // Only generate number for new reservations
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    
    // Get count of reservations today and increment
    const Reservation = this.constructor;
    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const todayEnd = new Date(date.setHours(23, 59, 59, 999));
    
    const reservationCount = await Reservation.countDocuments({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });
    
    // Format: RES-YY-MM-DD-XXX (where XXX is the sequential number)
    const sequentialNumber = ('000' + (reservationCount + 1)).slice(-3);
    this.reservationNumber = `RES-${year}${month}${day}-${sequentialNumber}`;
  }
  
  next();
});

const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation; 
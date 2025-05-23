const mongoose = require('mongoose');

// Day settings for each type of ordering
const daySettingsSchema = new mongoose.Schema({
  isCollectionAllowed: {
    type: Boolean,
    default: false
  },
  isDeliveryAllowed: {
    type: Boolean,
    default: false
  },
  isTableOrderingAllowed: {
    type: Boolean,
    default: false
  },
  defaultTimes: {
    start: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    },
    end: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    }
  },
  collection: {
    leadTime: {
      type: Number,
      default: 20,
      min: [0, 'Lead time cannot be negative']
    },
    displayedTime: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    }
  },
  delivery: {
    useDifferentTimes: {
      type: Boolean,
      default: false
    },
    leadTime: {
      type: Number,
      default: 45,
      min: [0, 'Lead time cannot be negative']
    },
    displayedTime: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    },
    customTimes: {
      start: {
        type: String,
        validate: {
          validator: function(v) {
            return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'Time must be in HH:MM format'
        }
      },
      end: {
        type: String,
        validate: {
          validator: function(v) {
            return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'Time must be in HH:MM format'
        }
      }
    }
  },
  tableOrdering: {
    useDifferentTimes: {
      type: Boolean,
      default: false
    },
    leadTime: {
      type: Number,
      default: 0,
      min: [0, 'Lead time cannot be negative']
    },
    displayedTime: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    },
    customTimes: {
      start: {
        type: String,
        validate: {
          validator: function(v) {
            return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'Time must be in HH:MM format'
        }
      },
      end: {
        type: String,
        validate: {
          validator: function(v) {
            return !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'Time must be in HH:MM format'
        }
      }
    }
  }
}, { _id: false });

// Closed date schema
const closedDateSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['single', 'range'],
    required: true
  },
  endDate: {
    type: Date,
    required: function() {
      return this.type === 'range';
    }
  },
  reason: {
    type: String,
    default: 'Closed'
  }
}, { timestamps: true });

// Order restriction day settings
const restrictionDaySettingsSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  orderTotal: {
    type: Number,
    default: 0,
    min: [0, 'Order total cannot be negative']
  },
  windowSize: {
    type: Number,
    default: 5,
    min: [1, 'Window size must be at least 1 minute']
  }
}, { _id: false });

// Main ordering times schema
const orderingTimesSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
      unique: true
    },
    // Daily ordering times for each day of the week
    weeklySchedule: {
      monday: daySettingsSchema,
      tuesday: daySettingsSchema,
      wednesday: daySettingsSchema,
      thursday: daySettingsSchema,
      friday: daySettingsSchema,
      saturday: daySettingsSchema,
      sunday: daySettingsSchema
    },
    // Closed dates management
    closedDates: [closedDateSchema],
    // Order restrictions
    restrictions: {
      type: {
        type: String,
        enum: ['None', 'Combined Total', 'Split Total'],
        default: 'None'
      },
      combined: {
        sunday: restrictionDaySettingsSchema,
        monday: restrictionDaySettingsSchema,
        tuesday: restrictionDaySettingsSchema,
        wednesday: restrictionDaySettingsSchema,
        thursday: restrictionDaySettingsSchema,
        friday: restrictionDaySettingsSchema,
        saturday: restrictionDaySettingsSchema
      },
      collection: {
        sunday: restrictionDaySettingsSchema,
        monday: restrictionDaySettingsSchema,
        tuesday: restrictionDaySettingsSchema,
        wednesday: restrictionDaySettingsSchema,
        thursday: restrictionDaySettingsSchema,
        friday: restrictionDaySettingsSchema,
        saturday: restrictionDaySettingsSchema
      },
      delivery: {
        sunday: restrictionDaySettingsSchema,
        monday: restrictionDaySettingsSchema,
        tuesday: restrictionDaySettingsSchema,
        wednesday: restrictionDaySettingsSchema,
        thursday: restrictionDaySettingsSchema,
        friday: restrictionDaySettingsSchema,
        saturday: restrictionDaySettingsSchema
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Default values for new documents
orderingTimesSchema.pre('save', function(next) {
  if (this.isNew) {
    const defaultDaySettings = {
      isCollectionAllowed: false,
      isDeliveryAllowed: false,
      isTableOrderingAllowed: false,
      defaultTimes: {
        start: "11:45",
        end: "21:50"
      },
      collection: {
        leadTime: 20,
        displayedTime: "12:10"
      },
      delivery: {
        useDifferentTimes: false,
        leadTime: 45,
        displayedTime: "12:30",
        customTimes: {
          start: "11:45",
          end: "21:50"
        }
      },
      tableOrdering: {
        useDifferentTimes: false,
        leadTime: 0,
        displayedTime: "",
        customTimes: {
          start: "11:45",
          end: "21:50"
        }
      }
    };

    const defaultRestrictionDaySettings = {
      enabled: false,
      orderTotal: 0,
      windowSize: 5
    };

    // Set default weekly schedule if not provided
    if (!this.weeklySchedule) {
      this.weeklySchedule = {
        monday: defaultDaySettings,
        tuesday: defaultDaySettings,
        wednesday: defaultDaySettings,
        thursday: defaultDaySettings,
        friday: defaultDaySettings,
        saturday: defaultDaySettings,
        sunday: defaultDaySettings
      };
    }

    // Set default restrictions if not provided
    if (!this.restrictions) {
      this.restrictions = {
        type: 'None',
        combined: {
          sunday: defaultRestrictionDaySettings,
          monday: defaultRestrictionDaySettings,
          tuesday: defaultRestrictionDaySettings,
          wednesday: defaultRestrictionDaySettings,
          thursday: defaultRestrictionDaySettings,
          friday: defaultRestrictionDaySettings,
          saturday: defaultRestrictionDaySettings
        },
        collection: {
          sunday: defaultRestrictionDaySettings,
          monday: defaultRestrictionDaySettings,
          tuesday: defaultRestrictionDaySettings,
          wednesday: defaultRestrictionDaySettings,
          thursday: defaultRestrictionDaySettings,
          friday: defaultRestrictionDaySettings,
          saturday: defaultRestrictionDaySettings
        },
        delivery: {
          sunday: defaultRestrictionDaySettings,
          monday: defaultRestrictionDaySettings,
          tuesday: defaultRestrictionDaySettings,
          wednesday: defaultRestrictionDaySettings,
          thursday: defaultRestrictionDaySettings,
          friday: defaultRestrictionDaySettings,
          saturday: defaultRestrictionDaySettings
        }
      };
    }
  }
  next();
});

// Method to check if ordering is allowed at a specific time
orderingTimesSchema.methods.isOrderingAllowed = function(day, orderType, currentTime) {
  const daySettings = this.weeklySchedule[day.toLowerCase()];
  if (!daySettings) return false;

  // Check if the order type is allowed for this day
  switch (orderType) {
    case 'collection':
      if (!daySettings.isCollectionAllowed) return false;
      break;
    case 'delivery':
      if (!daySettings.isDeliveryAllowed) return false;
      break;
    case 'tableOrdering':
      if (!daySettings.isTableOrderingAllowed) return false;
      break;
    default:
      return false;
  }

  // Check if current time is within allowed hours
  const times = orderType === 'delivery' && daySettings.delivery.useDifferentTimes
    ? daySettings.delivery.customTimes
    : orderType === 'tableOrdering' && daySettings.tableOrdering.useDifferentTimes
    ? daySettings.tableOrdering.customTimes
    : daySettings.defaultTimes;

  if (!times.start || !times.end) return false;

  const [startHour, startMin] = times.start.split(':').map(Number);
  const [endHour, endMin] = times.end.split(':').map(Number);
  const [currentHour, currentMin] = currentTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const currentMinutes = currentHour * 60 + currentMin;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

// Method to check if outlet is closed on a specific date
orderingTimesSchema.methods.isClosedOnDate = function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return this.closedDates.some(closedDate => {
    const closedStart = new Date(closedDate.date);
    closedStart.setHours(0, 0, 0, 0);

    if (closedDate.type === 'single') {
      return targetDate.getTime() === closedStart.getTime();
    } else if (closedDate.type === 'range' && closedDate.endDate) {
      const closedEnd = new Date(closedDate.endDate);
      closedEnd.setHours(23, 59, 59, 999);
      return targetDate >= closedStart && targetDate <= closedEnd;
    }
    return false;
  });
};

const OrderingTimes = mongoose.model('OrderingTimes', orderingTimesSchema);

module.exports = OrderingTimes; 
const Branch = require('../models/branch.model');
const OrderingTimes = require('../models/ordering-times.model');
const mongoose = require('mongoose');

const seedBranchData = async () => {
  try {
    // Clear existing data
    await Branch.deleteMany({});
    await OrderingTimes.deleteMany({});

    // Test Branch 1 - Full Service Branch
    const branch1 = await Branch.create({
      name: 'Downtown Restaurant',
      code: 'DTR001',
      aboutUs: 'Premium dining experience in the heart of the city',
      contact: {
        email: 'downtown@restaurant.com',
        phone: '+1-555-0123',
        telephone: '+1-555-0124'
      },
      address: {
        street: '123 Main Street',
        addressLine2: 'Floor 1',
        city: 'New York',
        county: 'Manhattan',
        state: 'NY',
        postalCode: '10001',
        country: 'USA'
      },
      location: {
        type: 'Point',
        coordinates: [-73.935242, 40.730610]
      },
      isActive: true,
      isDefault: true,
      orderingOptions: {
        collection: {
          displayFormat: 'TimeOnly',
          timeslotLength: 15
        },
        delivery: {
          displayFormat: 'DateAndTime',
          timeslotLength: 30
        }
      },
      preOrdering: {
        allowCollectionPreOrders: true,
        allowDeliveryPreOrders: true
      },
      isCollectionEnabled: true,
      isDeliveryEnabled: true,
      isTableOrderingEnabled: true
    });

    // Test Branch 2 - Collection Only Branch
    const branch2 = await Branch.create({
      name: 'Express Pickup',
      code: 'EXP002',
      aboutUs: 'Quick and convenient pickup location',
      contact: {
        email: 'express@restaurant.com',
        phone: '+1-555-0125'
      },
      address: {
        street: '456 Park Avenue',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA'
      },
      location: {
        type: 'Point',
        coordinates: [-73.989723, 40.692278]
      },
      isActive: true,
      orderingOptions: {
        collection: {
          displayFormat: 'TimeOnly',
          timeslotLength: 10
        }
      },
      preOrdering: {
        allowCollectionPreOrders: true,
        allowDeliveryPreOrders: false
      },
      isCollectionEnabled: true,
      isDeliveryEnabled: false,
      isTableOrderingEnabled: false
    });

    // Test Branch 3 - Delivery Only Branch
    const branch3 = await Branch.create({
      name: 'Cloud Kitchen',
      code: 'CLD003',
      aboutUs: 'Delivery-only ghost kitchen',
      contact: {
        email: 'cloud@restaurant.com',
        phone: '+1-555-0126'
      },
      address: {
        street: '789 Industrial Park',
        addressLine2: 'Unit 4B',
        city: 'Queens',
        state: 'NY',
        postalCode: '11101',
        country: 'USA'
      },
      location: {
        type: 'Point',
        coordinates: [-73.935242, 40.750610]
      },
      isActive: true,
      orderingOptions: {
        delivery: {
          displayFormat: 'DateAndTime',
          timeslotLength: 45
        }
      },
      preOrdering: {
        allowCollectionPreOrders: false,
        allowDeliveryPreOrders: true
      },
      isCollectionEnabled: false,
      isDeliveryEnabled: true,
      isTableOrderingEnabled: false
    });

    // Test Branch 4 - Inactive Branch
    const branch4 = await Branch.create({
      name: 'Seasonal Pop-up',
      code: 'POP004',
      aboutUs: 'Seasonal location - currently closed',
      contact: {
        email: 'popup@restaurant.com',
        phone: '+1-555-0127'
      },
      address: {
        street: '321 Beach Road',
        city: 'Staten Island',
        state: 'NY',
        postalCode: '10305',
        country: 'USA'
      },
      location: {
        type: 'Point',
        coordinates: [-74.075833, 40.579021]
      },
      isActive: false,
      orderingOptions: {
        collection: {
          displayFormat: 'TimeOnly',
          timeslotLength: 20
        },
        delivery: {
          displayFormat: 'TimeOnly',
          timeslotLength: 30
        }
      },
      preOrdering: {
        allowCollectionPreOrders: false,
        allowDeliveryPreOrders: false
      },
      isCollectionEnabled: false,
      isDeliveryEnabled: false,
      isTableOrderingEnabled: false
    });

    // Create Ordering Times for each branch
    const orderingTimes1 = await OrderingTimes.create({
      branchId: branch1._id,
      monday: {
        isOpen: true,
        openTime: '09:00',
        closeTime: '22:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '21:30'
        },
        collection: {
          isAvailable: true,
          startTime: '09:30',
          endTime: '21:45'
        }
      },
      tuesday: {
        isOpen: true,
        openTime: '09:00',
        closeTime: '22:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '21:30'
        },
        collection: {
          isAvailable: true,
          startTime: '09:30',
          endTime: '21:45'
        }
      },
      wednesday: {
        isOpen: true,
        openTime: '09:00',
        closeTime: '22:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '21:30'
        },
        collection: {
          isAvailable: true,
          startTime: '09:30',
          endTime: '21:45'
        }
      },
      thursday: {
        isOpen: true,
        openTime: '09:00',
        closeTime: '23:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '22:30'
        },
        collection: {
          isAvailable: true,
          startTime: '09:30',
          endTime: '22:45'
        }
      },
      friday: {
        isOpen: true,
        openTime: '09:00',
        closeTime: '23:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '22:30'
        },
        collection: {
          isAvailable: true,
          startTime: '09:30',
          endTime: '22:45'
        }
      },
      saturday: {
        isOpen: true,
        openTime: '10:00',
        closeTime: '23:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '22:30'
        },
        collection: {
          isAvailable: true,
          startTime: '10:30',
          endTime: '22:45'
        }
      },
      sunday: {
        isOpen: true,
        openTime: '10:00',
        closeTime: '22:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '21:30'
        },
        collection: {
          isAvailable: true,
          startTime: '10:30',
          endTime: '21:45'
        }
      },
      specialDates: []
    });

    const orderingTimes2 = await OrderingTimes.create({
      branchId: branch2._id,
      monday: {
        isOpen: true,
        openTime: '07:00',
        closeTime: '19:00',
        collection: {
          isAvailable: true,
          startTime: '07:00',
          endTime: '18:45'
        }
      },
      tuesday: {
        isOpen: true,
        openTime: '07:00',
        closeTime: '19:00',
        collection: {
          isAvailable: true,
          startTime: '07:00',
          endTime: '18:45'
        }
      },
      wednesday: {
        isOpen: true,
        openTime: '07:00',
        closeTime: '19:00',
        collection: {
          isAvailable: true,
          startTime: '07:00',
          endTime: '18:45'
        }
      },
      thursday: {
        isOpen: true,
        openTime: '07:00',
        closeTime: '19:00',
        collection: {
          isAvailable: true,
          startTime: '07:00',
          endTime: '18:45'
        }
      },
      friday: {
        isOpen: true,
        openTime: '07:00',
        closeTime: '20:00',
        collection: {
          isAvailable: true,
          startTime: '07:00',
          endTime: '19:45'
        }
      },
      saturday: {
        isOpen: true,
        openTime: '08:00',
        closeTime: '20:00',
        collection: {
          isAvailable: true,
          startTime: '08:00',
          endTime: '19:45'
        }
      },
      sunday: {
        isOpen: false
      },
      specialDates: [
        {
          date: new Date('2024-12-25'),
          isClosed: true,
          reason: 'Christmas Day'
        }
      ]
    });

    const orderingTimes3 = await OrderingTimes.create({
      branchId: branch3._id,
      monday: {
        isOpen: true,
        openTime: '11:00',
        closeTime: '23:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '22:45'
        }
      },
      tuesday: {
        isOpen: true,
        openTime: '11:00',
        closeTime: '23:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '22:45'
        }
      },
      wednesday: {
        isOpen: true,
        openTime: '11:00',
        closeTime: '23:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '22:45'
        }
      },
      thursday: {
        isOpen: true,
        openTime: '11:00',
        closeTime: '23:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '22:45'
        }
      },
      friday: {
        isOpen: true,
        openTime: '11:00',
        closeTime: '00:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '23:45'
        }
      },
      saturday: {
        isOpen: true,
        openTime: '11:00',
        closeTime: '00:00',
        delivery: {
          isAvailable: true,
          startTime: '11:00',
          endTime: '23:45'
        }
      },
      sunday: {
        isOpen: true,
        openTime: '12:00',
        closeTime: '22:00',
        delivery: {
          isAvailable: true,
          startTime: '12:00',
          endTime: '21:45'
        }
      },
      specialDates: []
    });

    console.log('Test branch data seeded successfully!');
    console.log('Created branches:', {
      branch1: branch1._id,
      branch2: branch2._id,
      branch3: branch3._id,
      branch4: branch4._id
    });

  } catch (error) {
    console.error('Error seeding branch data:', error);
  }
};

module.exports = seedBranchData; 
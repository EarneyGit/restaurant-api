const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testDiscount = {
  name: 'Test Discount',
  code: 'TEST10',
  allowMultipleCoupons: false,
  discountType: 'percentage',
  discountValue: 10,
  minSpend: 20,
  maxSpend: 100,
  outlets: {
    dunfermline: true,
    edinburgh: true,
    glasgow: false
  },
  timeDependent: true,
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  maxUses: {
    total: 100,
    perCustomer: 1,
    perDay: 10
  },
  daysAvailable: {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true
  },
  serviceTypes: {
    collection: true,
    delivery: true,
    tableOrdering: false
  },
  firstOrderOnly: false,
  isActive: true
};

const testBusinessOffer = {
  title: 'Test Business Offer',
  content: '<p>This is a test business offer with <strong>HTML content</strong>.</p>',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  displayOrder: 1,
  isActive: true
};

// Helper function to get auth token (you'll need to replace this with actual login)
async function getAuthToken() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com', // Replace with actual admin credentials
      password: 'password123'
    });
    return response.data.token;
  } catch (error) {
    console.error('Failed to get auth token:', error.response?.data || error.message);
    return null;
  }
}

// Test discount validation (public endpoint)
async function testDiscountValidation() {
  console.log('\n=== Testing Discount Validation ===');
  
  try {
    const response = await axios.post(`${BASE_URL}/discounts/validate`, {
      code: 'TEST10',
      branchId: '507f1f77bcf86cd799439011', // Replace with actual branch ID
      orderTotal: 50,
      deliveryMethod: 'delivery'
    });
    
    console.log('✅ Discount validation successful:', response.data);
  } catch (error) {
    console.log('❌ Discount validation failed:', error.response?.data || error.message);
  }
}

// Test discount CRUD operations
async function testDiscountCRUD(token) {
  console.log('\n=== Testing Discount CRUD ===');
  
  const headers = { Authorization: `Bearer ${token}` };
  let discountId;
  
  try {
    // Create discount
    console.log('Creating discount...');
    const createResponse = await axios.post(`${BASE_URL}/discounts`, testDiscount, { headers });
    discountId = createResponse.data.data._id;
    console.log('✅ Discount created:', createResponse.data.data.name);
    
    // Get all discounts
    console.log('Getting all discounts...');
    const getAllResponse = await axios.get(`${BASE_URL}/discounts`, { headers });
    console.log('✅ Got discounts:', getAllResponse.data.data.length, 'discounts');
    
    // Get single discount
    console.log('Getting single discount...');
    const getOneResponse = await axios.get(`${BASE_URL}/discounts/${discountId}`, { headers });
    console.log('✅ Got discount:', getOneResponse.data.data.name);
    
    // Update discount
    console.log('Updating discount...');
    const updateResponse = await axios.put(`${BASE_URL}/discounts/${discountId}`, {
      name: 'Updated Test Discount',
      discountValue: 15
    }, { headers });
    console.log('✅ Discount updated:', updateResponse.data.data.name);
    
    // Get discount stats
    console.log('Getting discount stats...');
    const statsResponse = await axios.get(`${BASE_URL}/discounts/stats`, { headers });
    console.log('✅ Got discount stats:', statsResponse.data.data);
    
    // Delete discount
    console.log('Deleting discount...');
    const deleteResponse = await axios.delete(`${BASE_URL}/discounts/${discountId}`, { headers });
    console.log('✅ Discount deleted:', deleteResponse.data.message);
    
  } catch (error) {
    console.log('❌ Discount CRUD failed:', error.response?.data || error.message);
  }
}

// Test business offer CRUD operations
async function testBusinessOfferCRUD(token) {
  console.log('\n=== Testing Business Offer CRUD ===');
  
  const headers = { Authorization: `Bearer ${token}` };
  let offerId;
  
  try {
    // Create business offer
    console.log('Creating business offer...');
    const createResponse = await axios.post(`${BASE_URL}/business-offers`, testBusinessOffer, { headers });
    offerId = createResponse.data.data._id;
    console.log('✅ Business offer created:', createResponse.data.data.title);
    
    // Get all business offers
    console.log('Getting all business offers...');
    const getAllResponse = await axios.get(`${BASE_URL}/business-offers`, { headers });
    console.log('✅ Got business offers:', getAllResponse.data.data.length, 'offers');
    
    // Get single business offer
    console.log('Getting single business offer...');
    const getOneResponse = await axios.get(`${BASE_URL}/business-offers/${offerId}`, { headers });
    console.log('✅ Got business offer:', getOneResponse.data.data.title);
    
    // Track offer view (public endpoint)
    console.log('Tracking offer view...');
    const viewResponse = await axios.post(`${BASE_URL}/business-offers/${offerId}/view`);
    console.log('✅ Offer view tracked:', viewResponse.data.message);
    
    // Track offer click (public endpoint)
    console.log('Tracking offer click...');
    const clickResponse = await axios.post(`${BASE_URL}/business-offers/${offerId}/click`);
    console.log('✅ Offer click tracked:', clickResponse.data.message);
    
    // Update business offer
    console.log('Updating business offer...');
    const updateResponse = await axios.put(`${BASE_URL}/business-offers/${offerId}`, {
      title: 'Updated Test Business Offer',
      displayOrder: 2
    }, { headers });
    console.log('✅ Business offer updated:', updateResponse.data.data.title);
    
    // Get business offer stats
    console.log('Getting business offer stats...');
    const statsResponse = await axios.get(`${BASE_URL}/business-offers/stats`, { headers });
    console.log('✅ Got business offer stats:', statsResponse.data.data);
    
    // Delete business offer
    console.log('Deleting business offer...');
    const deleteResponse = await axios.delete(`${BASE_URL}/business-offers/${offerId}`, { headers });
    console.log('✅ Business offer deleted:', deleteResponse.data.message);
    
  } catch (error) {
    console.log('❌ Business offer CRUD failed:', error.response?.data || error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API Tests...');
  
  // Test public endpoints first
  await testDiscountValidation();
  
  // Get auth token for protected endpoints
  const token = await getAuthToken();
  
  if (!token) {
    console.log('❌ Cannot run protected endpoint tests without auth token');
    console.log('Please update the getAuthToken() function with valid admin credentials');
    return;
  }
  
  // Test protected endpoints
  await testDiscountCRUD(token);
  await testBusinessOfferCRUD(token);
  
  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error); 
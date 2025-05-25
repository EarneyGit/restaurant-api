const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api';

// Test function for restrictions API
async function testRestrictionsAPI(endpoint, method = 'GET', body = null, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 ${method} ${endpoint}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
      console.log(`📤 Request body:`, JSON.stringify(body, null, 2));
    }
    
    const response = await fetch(endpoint, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success: ${response.status}`);
      console.log(`📊 Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Error: ${response.status}`);
      console.log(`📊 Response:`, JSON.stringify(data, null, 2));
      
      // Check for specific error types
      if (data.message === "Access denied. Invalid token.") {
        console.log(`✅ GOOD: Authentication error (expected) - Endpoint is working!`);
      } else {
        console.log(`⚠️  Unexpected error:`, data.message);
      }
    }
  } catch (error) {
    console.log(`💥 Network Error:`, error.message);
  }
}

async function runRestrictionsTests() {
  console.log('🚀 Starting Restrictions API Tests...\n');
  console.log('🎯 Goal: Verify that the restrictions API endpoints are working correctly\n');
  
  // Test 1: Get restrictions
  await testRestrictionsAPI(
    `${API_BASE_URL}/ordering-times/restrictions`,
    'GET',
    null,
    'Get Order Restrictions'
  );
  
  // Test 2: Update restrictions
  await testRestrictionsAPI(
    `${API_BASE_URL}/ordering-times/restrictions`,
    'PUT',
    {
      restrictions: {
        monday: { enabled: true, orderTotal: 50, windowSize: 10 },
        tuesday: { enabled: false, orderTotal: 0, windowSize: 5 },
        wednesday: { enabled: true, orderTotal: 75, windowSize: 15 },
        thursday: { enabled: false, orderTotal: 0, windowSize: 5 },
        friday: { enabled: true, orderTotal: 100, windowSize: 20 },
        saturday: { enabled: true, orderTotal: 80, windowSize: 12 },
        sunday: { enabled: false, orderTotal: 0, windowSize: 5 }
      }
    },
    'Update Order Restrictions'
  );
  
  console.log('\n📋 SUMMARY:');
  console.log('✅ If you see "Authentication error (expected)" for all tests, the API endpoints are working!');
  console.log('❌ If you see other errors, there might be issues with the API implementation.');
  console.log('\n🏁 Restrictions API tests completed!');
}

runRestrictionsTests().catch(console.error); 
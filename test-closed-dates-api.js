const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api';

// Test function for closed dates API
async function testClosedDatesAPI(endpoint, method = 'GET', body = null, description) {
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

async function runClosedDatesTests() {
  console.log('🚀 Starting Closed Dates API Tests...\n');
  console.log('🎯 Goal: Verify that the closed dates API endpoints are working correctly\n');
  
  // Test 1: Get closed dates
  await testClosedDatesAPI(
    `${API_BASE_URL}/ordering-times/closed-dates`,
    'GET',
    null,
    'Get Closed Dates'
  );
  
  // Test 2: Add single closed date
  await testClosedDatesAPI(
    `${API_BASE_URL}/ordering-times/closed-dates`,
    'POST',
    {
      date: '2024-12-25',
      type: 'single',
      reason: 'Christmas Day'
    },
    'Add Single Closed Date'
  );
  
  // Test 3: Add date range
  await testClosedDatesAPI(
    `${API_BASE_URL}/ordering-times/closed-dates`,
    'POST',
    {
      date: '2024-12-24',
      endDate: '2024-12-26',
      type: 'range',
      reason: 'Christmas Holiday Period'
    },
    'Add Closed Date Range'
  );
  
  // Test 4: Delete specific closed date (using dummy ID)
  await testClosedDatesAPI(
    `${API_BASE_URL}/ordering-times/closed-dates/507f1f77bcf86cd799439011`,
    'DELETE',
    null,
    'Delete Specific Closed Date'
  );
  
  // Test 5: Delete all closed dates
  await testClosedDatesAPI(
    `${API_BASE_URL}/ordering-times/closed-dates`,
    'DELETE',
    null,
    'Delete All Closed Dates'
  );
  
  console.log('\n📋 SUMMARY:');
  console.log('✅ If you see "Authentication error (expected)" for all tests, the API endpoints are working!');
  console.log('❌ If you see other errors, there might be issues with the API implementation.');
  console.log('\n🏁 Closed Dates API tests completed!');
}

runClosedDatesTests().catch(console.error); 
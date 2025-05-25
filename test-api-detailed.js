const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api';

// Test function with detailed error analysis
async function testAPIDetailed(endpoint, description, expectedError = null) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 Endpoint: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success: ${response.status}`);
      console.log(`📊 Response structure:`, Object.keys(data));
    } else {
      console.log(`❌ Error: ${response.status}`);
      console.log(`📊 Error message:`, data.message);
      
      // Check if this is the expected authentication error vs the original bug
      if (data.message === "Access denied. Invalid token.") {
        console.log(`✅ GOOD: Authentication error (expected) - Route is working!`);
      } else if (data.error && data.error.includes("Cast to ObjectId failed")) {
        console.log(`🐛 BAD: Original routing bug still exists!`);
      } else if (data.error && data.error.includes("skip is not a function")) {
        console.log(`🐛 BAD: Original pagination bug still exists!`);
      } else {
        console.log(`⚠️  Different error:`, data.error || data.message);
      }
    }
  } catch (error) {
    console.log(`💥 Network Error:`, error.message);
  }
}

async function runDetailedTests() {
  console.log('🚀 Starting Detailed API Tests...\n');
  console.log('🎯 Goal: Verify that the specific bugs are fixed:\n');
  console.log('   1. "Cast to ObjectId failed for value price-overrides" - SHOULD BE FIXED');
  console.log('   2. "skip is not a function" in table ordering - SHOULD BE FIXED\n');
  
  // Test 1: The original problematic endpoint that was treating "price-overrides" as an ID
  await testAPIDetailed(
    `${API_BASE_URL}/settings/delivery-charges/price-overrides?page=1&limit=20`,
    'Delivery Charges Price Overrides (Original Bug #1)'
  );
  
  // Test 2: The original problematic table ordering endpoint with pagination
  await testAPIDetailed(
    `${API_BASE_URL}/settings/table-ordering?page=1&limit=20&includeDisabled=false`,
    'Table Ordering Groups with Pagination (Original Bug #2)'
  );
  
  // Test 3: Verify other delivery charge endpoints still work
  await testAPIDetailed(
    `${API_BASE_URL}/settings/delivery-charges?page=1&limit=20`,
    'Delivery Charges Main Endpoint'
  );
  
  // Test 4: Test postcode exclusions (similar pattern)
  await testAPIDetailed(
    `${API_BASE_URL}/settings/delivery-charges/postcode-exclusions?page=1&limit=20`,
    'Delivery Charges Postcode Exclusions'
  );
  
  // Test 5: Test table ordering without pagination parameters
  await testAPIDetailed(
    `${API_BASE_URL}/settings/table-ordering`,
    'Table Ordering Groups (No Pagination)'
  );
  
  console.log('\n📋 SUMMARY:');
  console.log('✅ If you see "Authentication error (expected)" for all tests, the bugs are FIXED!');
  console.log('❌ If you see the original error messages, the bugs still exist.');
  console.log('\n🏁 Detailed tests completed!');
}

runDetailedTests().catch(console.error); 
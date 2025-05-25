const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api';

// Test function
async function testAPI(endpoint, description) {
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
      console.log(`📊 Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Error: ${response.status}`);
      console.log(`📊 Response:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`💥 Network Error:`, error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  // Test 1: Delivery Charges Price Overrides (the problematic endpoint)
  await testAPI(
    `${API_BASE_URL}/settings/delivery-charges/price-overrides?page=1&limit=20`,
    'Delivery Charges Price Overrides'
  );
  
  // Test 2: Table Ordering (the other problematic endpoint)
  await testAPI(
    `${API_BASE_URL}/settings/table-ordering?page=1&limit=20&includeDisabled=false`,
    'Table Ordering Groups'
  );
  
  // Test 3: Delivery Charges (should work)
  await testAPI(
    `${API_BASE_URL}/settings/delivery-charges?page=1&limit=20`,
    'Delivery Charges'
  );
  
  // Test 4: Service Charges (should work)
  await testAPI(
    `${API_BASE_URL}/settings/service-charges?page=1&limit=20`,
    'Service Charges'
  );
  
  console.log('\n🏁 Tests completed!');
}

runTests().catch(console.error); 
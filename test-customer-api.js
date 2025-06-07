// Test Customer API endpoints
async function testCustomerAPI() {
  const baseUrl = 'http://localhost:5000/api/customers';
  
  // Dynamic import for node-fetch
  const { default: fetch } = await import('node-fetch');
  
  console.log('🧪 Testing Customer API Integration\n');

  // You'll need to get a valid admin JWT token first
  // For testing, you can get this by logging in as an admin user
  const adminToken = 'your_admin_jwt_token_here'; // Replace with actual token
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // Test 1: Get Customer Statistics
  console.log('1️⃣ Testing Customer Statistics');
  try {
    const response = await fetch(`${baseUrl}/stats`, {
      method: 'GET',
      headers
    });

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Get All Customers (first page)
  console.log('2️⃣ Testing Get All Customers');
  try {
    const response = await fetch(`${baseUrl}?page=1&limit=5`, {
      method: 'GET',
      headers
    });
    
    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Search Customers by Name
  console.log('3️⃣ Testing Search Customers by Name');
  try {
    const response = await fetch(`${baseUrl}?firstName=John&page=1&limit=5`, {
      method: 'GET',
      headers
    });

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Get Customer Details (you'll need a valid customer ID)
  console.log('4️⃣ Testing Get Customer Details');
  try {
    // First get a customer ID from the list
    const listResponse = await fetch(`${baseUrl}?page=1&limit=1`, {
      method: 'GET',
      headers
    });
    
    const listData = await listResponse.json();
    
    if (listData.success && listData.data.length > 0) {
      const customerId = listData.data[0].id;
      
      const response = await fetch(`${baseUrl}/${customerId}`, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      console.log('✅ Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('⚠️ No customers found to test details endpoint');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 5: Test without authentication (should fail)
  console.log('5️⃣ Testing Without Authentication (should fail)');
  try {
    const response = await fetch(`${baseUrl}/stats`);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Instructions for getting admin token
console.log('📋 Instructions for Testing:');
console.log('1. Start the server: npm start');
console.log('2. Login as an admin user to get JWT token');
console.log('3. Replace "your_admin_jwt_token_here" with the actual token');
console.log('4. Make sure you have some orders in the database with user references');
console.log('5. Run this test: node test-customer-api.js');

console.log('\n' + '='.repeat(50) + '\n');

// Example API endpoints
console.log('📍 Customer API Endpoints:');
console.log('GET /api/customers - Get all customers with filtering');
console.log('GET /api/customers/stats - Get customer statistics');
console.log('GET /api/customers/:id - Get customer details');
console.log('');
console.log('Query Parameters for GET /api/customers:');
console.log('- page: Page number (default: 1)');
console.log('- limit: Items per page (default: 20)');
console.log('- userId: Filter by user ID');
console.log('- firstName: Filter by first name');
console.log('- lastName: Filter by last name');
console.log('- email: Filter by email');
console.log('- mobile: Filter by mobile number');
console.log('- postcode: Filter by postcode');
console.log('- sortBy: Sort field (name, email, totalOrders, totalSpent, lastOrderDate)');
console.log('- sortOrder: Sort direction (asc, desc)');

console.log('\n' + '='.repeat(50) + '\n');

// Run tests if this file is executed directly
if (require.main === module) {
  testCustomerAPI().catch(console.error);
}

module.exports = { testCustomerAPI }; 
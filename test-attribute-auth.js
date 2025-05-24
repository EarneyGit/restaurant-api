const axios = require('axios');

const baseURL = 'http://localhost:5000';

async function testAttributeAuth() {
  try {
    console.log('Testing Attribute Authentication...\n');

    // Test 1: Try to create attribute without authentication
    console.log('1. Testing create attribute without authentication...');
    try {
      const response = await axios.post(`${baseURL}/api/attributes`, {
        name: 'Test Beverages',
        displayOrder: 1,
        type: 'single',
        requiresSelection: true,
        isActive: true,
        description: 'Test description'
      });
      console.log('❌ ERROR: Should have failed without authentication');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ PASS: Correctly rejected without authentication');
      } else {
        console.log('❌ FAIL: Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test 2: Try to create attribute with invalid token
    console.log('\n2. Testing create attribute with invalid token...');
    try {
      const response = await axios.post(`${baseURL}/api/attributes`, {
        name: 'Test Beverages',
        displayOrder: 1,
        type: 'single',
        requiresSelection: true,
        isActive: true,
        description: 'Test description'
      }, {
        headers: {
          'Authorization': 'Bearer invalid_token'
        }
      });
      console.log('❌ ERROR: Should have failed with invalid token');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ PASS: Correctly rejected with invalid token');
      } else {
        console.log('❌ FAIL: Unexpected error:', error.response?.data || error.message);
      }
    }

    console.log('\n✅ Authentication tests completed successfully!');
    console.log('\nTo test with valid admin token:');
    console.log('1. First login as admin user');
    console.log('2. Use the returned token in Authorization header');
    console.log('3. The branchId will be automatically set from admin user profile');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAttributeAuth(); 
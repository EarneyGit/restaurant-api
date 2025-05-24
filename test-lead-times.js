const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testLeadTimesAPI() {
  console.log('🧪 Testing Lead Times API...\n');

  try {
    // Test 1: Get current lead times
    console.log('1️⃣ Testing GET /api/settings/lead-times');
    const getResponse = await api.get('/api/settings/lead-times');
    console.log('✅ GET Success:', getResponse.data);
    console.log('');

    // Test 2: Update lead times
    console.log('2️⃣ Testing PUT /api/settings/lead-times');
    const updateData = {
      collection: '25 mins',
      delivery: '50 mins'
    };
    
    const updateResponse = await api.put('/api/settings/lead-times', updateData);
    console.log('✅ PUT Success:', updateResponse.data);
    console.log('');

    // Test 3: Verify the update
    console.log('3️⃣ Verifying update by getting lead times again');
    const verifyResponse = await api.get('/api/settings/lead-times');
    console.log('✅ Verification Success:', verifyResponse.data);
    
    // Check if values match
    const { collection, delivery } = verifyResponse.data.data;
    if (collection === '25 mins' && delivery === '50 mins') {
      console.log('✅ Values updated correctly!');
    } else {
      console.log('❌ Values not updated correctly');
    }

  } catch (error) {
    console.error('❌ Test failed:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
  }
}

// Test error cases
async function testErrorCases() {
  console.log('\n🧪 Testing Error Cases...\n');

  try {
    // Test invalid data
    console.log('1️⃣ Testing invalid lead time format');
    await api.put('/api/settings/lead-times', {
      collection: 'invalid',
      delivery: '45 mins'
    });
  } catch (error) {
    console.log('✅ Expected error for invalid format:', error.response?.data?.message);
  }

  try {
    // Test missing data
    console.log('2️⃣ Testing missing delivery field');
    await api.put('/api/settings/lead-times', {
      collection: '20 mins'
    });
  } catch (error) {
    console.log('✅ Expected error for missing field:', error.response?.data?.message);
  }
}

// Run tests
async function runTests() {
  if (TEST_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('❌ Please update TEST_TOKEN with a valid JWT token');
    console.log('You can get a token by logging in through the auth API');
    return;
  }

  await testLeadTimesAPI();
  await testErrorCases();
  
  console.log('\n🎉 All tests completed!');
}

runTests(); 
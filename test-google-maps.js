// Test Google Maps API integration
async function testGoogleMapsAPI() {
  const baseUrl = 'http://localhost:5000/api/addresses';
  
  // Dynamic import for node-fetch
  const { default: fetch } = await import('node-fetch');
  
  console.log('🧪 Testing Google Maps API Integration\n');

  // Test 1: Postcode to Address (POST)
  console.log('1️⃣ Testing Postcode to Address (POST method)');
  try {
    const response = await fetch(`${baseUrl}/postcode-to-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        postcode: 'SW1A 1AA' // Buckingham Palace postcode
      })
    });

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Postcode to Address (GET)
  console.log('2️⃣ Testing Postcode to Address (GET method)');
  try {
    const postcode = 'M1 1AA'; // Manchester postcode
    const response = await fetch(`${baseUrl}/postcode/${encodeURIComponent(postcode)}`);
    
    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Validate Postcode
  console.log('3️⃣ Testing Postcode Validation');
  try {
    const response = await fetch(`${baseUrl}/validate-postcode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        postcode: 'EH1 1YZ' // Edinburgh postcode
      })
    });

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Invalid Postcode
  console.log('4️⃣ Testing Invalid Postcode');
  try {
    const response = await fetch(`${baseUrl}/validate-postcode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        postcode: 'INVALID123'
      })
    });

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 5: API Status (requires authentication)
  console.log('5️⃣ Testing API Status (will fail without auth)');
  try {
    const response = await fetch(`${baseUrl}/status`);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Example postcodes for testing
const examplePostcodes = [
  'SW1A 1AA', // Buckingham Palace
  'M1 1AA',   // Manchester
  'EH1 1YZ',  // Edinburgh
  'G1 1AA',   // Glasgow
  'B1 1AA',   // Birmingham
  'LS1 1AA',  // Leeds
  'NE1 1AA',  // Newcastle
  'CF1 1AA',  // Cardiff
  'BT1 1AA',  // Belfast
  'PL1 1AA'   // Plymouth
];

console.log('📍 Example UK Postcodes for Testing:');
examplePostcodes.forEach((postcode, index) => {
  console.log(`${index + 1}. ${postcode}`);
});

console.log('\n' + '='.repeat(50) + '\n');

// Run tests if this file is executed directly
if (require.main === module) {
  testGoogleMapsAPI().catch(console.error);
}

module.exports = { testGoogleMapsAPI, examplePostcodes }; 
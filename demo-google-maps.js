// Demo Google Maps Service without server
const googleMapsService = require('./src/utils/googleMaps');

async function demoGoogleMapsService() {
  console.log('🗺️  Google Maps API Integration Demo\n');
  
  // Test postcodes
  const testPostcodes = [
    'SW1A 1AA', // Buckingham Palace
    'M1 1AA',   // Manchester
    'EH1 1YZ',  // Edinburgh
    'INVALID'   // Invalid postcode
  ];

  console.log('📍 Testing Postcode Validation:');
  console.log('================================\n');

  for (const postcode of testPostcodes) {
    const isValid = googleMapsService.validateUKPostcode(postcode);
    console.log(`${postcode.padEnd(10)} -> ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test address conversion (will fail without API key, but shows the structure)
  console.log('🏠 Testing Address Conversion:');
  console.log('==============================\n');

  const testPostcode = 'SW1A 1AA';
  console.log(`Testing postcode: ${testPostcode}`);
  
  try {
    const result = await googleMapsService.postcodeToAddress(testPostcode);
    
    if (result.success) {
      console.log('✅ Success! Address data:');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ Failed:', result.error);
      console.log('\n💡 This is expected if Google Maps API key is not configured.');
      console.log('   To enable this feature:');
      console.log('   1. Get a Google Maps API key from Google Cloud Console');
      console.log('   2. Enable the Geocoding API');
      console.log('   3. Set GOOGLE_MAPS_API_KEY in your .env file');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');
  console.log('📚 API Endpoints Available:');
  console.log('===========================\n');
  
  const endpoints = [
    {
      method: 'POST',
      path: '/api/addresses/postcode-to-address',
      description: 'Convert postcode to full address',
      access: 'Public'
    },
    {
      method: 'GET',
      path: '/api/addresses/postcode/:postcode',
      description: 'Get address by postcode (GET method)',
      access: 'Public'
    },
    {
      method: 'POST',
      path: '/api/addresses/validate-postcode',
      description: 'Validate postcode format',
      access: 'Public'
    },
    {
      method: 'POST',
      path: '/api/addresses/batch-postcode-to-address',
      description: 'Convert multiple postcodes (max 10)',
      access: 'Admin only'
    },
    {
      method: 'GET',
      path: '/api/addresses/status',
      description: 'Check API configuration status',
      access: 'Admin only'
    }
  ];

  endpoints.forEach((endpoint, index) => {
    console.log(`${index + 1}. ${endpoint.method} ${endpoint.path}`);
    console.log(`   Description: ${endpoint.description}`);
    console.log(`   Access: ${endpoint.access}\n`);
  });

  console.log('🔧 Configuration Required:');
  console.log('==========================\n');
  console.log('Environment Variables:');
  console.log('- GOOGLE_MAPS_API_KEY=your_api_key_here');
  console.log('\nGoogle Cloud Console Setup:');
  console.log('1. Create/select a project');
  console.log('2. Enable Geocoding API');
  console.log('3. Create API key credentials');
  console.log('4. Restrict API key for security');

  console.log('\n✨ Features:');
  console.log('============\n');
  console.log('✅ UK postcode validation');
  console.log('✅ Postcode to address conversion');
  console.log('✅ Geocoding (latitude/longitude)');
  console.log('✅ Batch processing');
  console.log('✅ Rate limiting protection');
  console.log('✅ Comprehensive error handling');
  console.log('✅ Public and admin endpoints');
}

// Run demo
if (require.main === module) {
  demoGoogleMapsService().catch(console.error);
}

module.exports = { demoGoogleMapsService }; 
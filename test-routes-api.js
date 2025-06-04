// Test script for the updated Google Maps Routes API integration
require('dotenv').config();
const googleMapsService = require('./src/utils/googleMaps');

async function testRoutesAPI() {
  console.log('🗺️ Testing Google Maps Routes API Integration');
  console.log('==================================================');

  // Test coordinates (London landmarks)
  const from = { lat: 51.5074, lng: -0.1278 }; // London center
  const to = { lat: 51.5171, lng: -0.1062 };   // St. Paul's Cathedral

  console.log(`📍 Testing distance calculation from (${from.lat}, ${from.lng}) to (${to.lat}, ${to.lng})`);
  console.log('Travel mode: driving, Unit: metric');
  
  try {
    const result = await googleMapsService.calculateDistance(from, to, 'metric', 'driving');
    console.log('\n✅ Response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n📊 Distance:', result.data.distance.text);
      console.log('⏱️ Duration:', result.data.duration.text);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n==================================================');

  // Test with different travel mode
  console.log(`📍 Testing distance calculation with walking mode`);
  console.log('Travel mode: walking, Unit: imperial');
  
  try {
    const result = await googleMapsService.calculateDistance(from, to, 'imperial', 'walking');
    console.log('\n✅ Response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n📊 Distance:', result.data.distance.text);
      console.log('⏱️ Duration:', result.data.duration.text);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the tests
testRoutesAPI().catch(error => {
  console.error('Test failed:', error);
}); 
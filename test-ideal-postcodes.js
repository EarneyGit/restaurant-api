// Test Ideal Postcodes API integration
async function testIdealPostcodesAPI() {
  const baseUrl = 'http://localhost:5000/api/addresses';
  
  // Dynamic import for node-fetch
  const { default: fetch } = await import('node-fetch');
  
  console.log('🧪 Testing Ideal Postcodes API Integration\n');

  // Test: Get addresses by postcode using Ideal Postcodes API
  console.log('Testing Get Addresses by Postcode (Ideal Postcodes API)');
  try {
    const postcode = 'KY11 8LE'; // Example postcode
    const response = await fetch(`${baseUrl}/postcode1/${encodeURIComponent(postcode)}`);
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Success! Found ${data.data.length} addresses for postcode ${postcode}`);
      console.log(`First address: ${data.data[0].line_1}, ${data.data[0].post_town}`);
      console.log(`Last address: ${data.data[data.data.length-1].line_1}, ${data.data[data.data.length-1].post_town}`);
    } else {
      console.log('❌ Error:', data.message);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. The server is running (npm run dev)');
    console.log('   2. IDEAL_POSTCODES_API_KEY is set in your .env file');
  }
}

// Run the test
testIdealPostcodesAPI().catch(console.error); 
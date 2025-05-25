const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testCategoryCreation() {
  try {
    console.log('Testing category creation with branch ID fixes...');
    
    // First, try to login as an admin user
    console.log('1. Attempting login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com', // Replace with actual admin email
      password: 'password123' // Replace with actual password
    });
    
    if (loginResponse.data.success) {
      console.log('✓ Login successful');
      console.log('User:', loginResponse.data.user);
      
      const token = loginResponse.data.token;
      const user = loginResponse.data.user;
      
      if (!user.branchId) {
        console.log('⚠ Warning: User does not have a branchId assigned');
        return;
      }
      
      console.log('✓ User has branchId:', user.branchId);
      
      // Now try to create a category
      console.log('2. Attempting to create category...');
      
      const categoryData = new FormData();
      categoryData.append('name', 'Test Category');
      categoryData.append('displayOrder', '1');
      categoryData.append('hidden', 'false');
      
      const categoryResponse = await axios.post(`${BASE_URL}/categories`, categoryData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (categoryResponse.data.success) {
        console.log('✓ Category created successfully');
        console.log('Category:', categoryResponse.data.data);
      } else {
        console.log('✗ Category creation failed:', categoryResponse.data.message);
      }
      
    } else {
      console.log('✗ Login failed:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.log('✗ Error:', error.response?.data?.message || error.message);
    if (error.response?.data?.error) {
      console.log('Detailed error:', error.response.data.error);
    }
  }
}

// Run the test
testCategoryCreation(); 
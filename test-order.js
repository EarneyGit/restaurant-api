const axios = require('axios');

const testOrder = {
  branchId: '6829bf447ecc1e0e2bd7931f',
  products: [
    {
      product: '6831c69e027f9682dfa22a35',
      quantity: 1,
      price: 3,
      notes: '',
      selectedAttributes: []
    }
  ],
  deliveryMethod: 'delivery',
  deliveryAddress: {
    street: '6/102',
    city: 'SILUKKUVARPATTI',
    state: 'Tamil Nadu',
    postalCode: '624215',
    country: 'USA',
    notes: ''
  },
  paymentMethod: 'card',
  paymentStatus: 'pending',
  customerNotes: '',
  totalAmount: 24.8
};

console.log('Testing order creation with payload:', JSON.stringify(testOrder, null, 2));

axios.post('http://localhost:5000/api/orders', testOrder)
  .then(response => {
    console.log('✅ Success:', response.data);
  })
  .catch(error => {
    console.log('❌ Error details:');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Data:', error.response?.data);
    console.log('Message:', error.message);
    console.log('Code:', error.code);
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }); 
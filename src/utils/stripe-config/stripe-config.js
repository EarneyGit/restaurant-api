require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Function to create a Payment Intent
async function createPaymentIntent(amount, currency, description) {
  try {
    if (!amount || typeof amount !== 'number') {
      throw new Error('Invalid or missing amount');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(
      "paymentId: ", paymentIntent.id, "\n",
      "Total Amount: ", paymentIntent.amount, "\n",
      "Received Amount: ", paymentIntent.amount_received, "\n",
      "Client Secret: ", paymentIntent.client_secret, "\n",
      "Receipt Email: ", paymentIntent.receipt_email, "\n",
      "Currency: ", paymentIntent.currency, "\n",
      "Description: ", paymentIntent.description, "\n",
      "Payment Method Configuration Id: ", paymentIntent.payment_method_configuration_details.id, "\n",
      "Payment Method Types: ", paymentIntent.payment_method_types, "\n",
      "Confirmation Method: ", paymentIntent.confirmation_method, "\n",
      "Status: ", paymentIntent.status, "\n",
      "Canceled At: ", paymentIntent.canceled_at, "\n",
      "Created At: ", paymentIntent.created, "\n",
    );

    return {
      clientSecret: paymentIntent.client_secret,
      dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
    };
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
}

// Function to check the payment status based on the payment intent
function checkPaymentStatus(paymentIntent) {
  try {
    const status = paymentIntent.status;

    switch (status) {
      case 'succeeded':
        return { success: true, message: 'Payment successful' };

      case 'requires_payment_method':
        return { success: false, message: 'Payment failed or requires a new payment method' };

      case 'requires_action':
        console.log('Additional action required, like 3D Secure.');
        return { success: false, message: 'Additional user action required' };

      case 'processing':
        return { success: false, message: 'Payment is still processing' };

      case 'canceled':
        return { success: false, message: 'Payment was canceled' };

      default:
        return { success: false, message: 'Unexpected payment status' };
    }
  } catch (error) {
    console.error("Error checking payment status:", error.message);
    throw new Error(`Failed to check payment status: ${error.message}`);
  }
}

// Function to get the payment intent status by intent ID
async function getPaymentIntentStatus(paymentIntentId) {
  try {
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      throw new Error('Invalid or missing payment intent ID');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log(
      "paymentId: ", paymentIntent.id, "\n",
      "Total Amount: ", paymentIntent.amount, "\n",
      "Received Amount: ", paymentIntent.amount_received, "\n",
      "Client Secret: ", paymentIntent.client_secret, "\n",
      "Receipt Email: ", paymentIntent.receipt_email, "\n",
      "Currency: ", paymentIntent.currency, "\n",
      "Description: ", paymentIntent.description, "\n",
      "Payment Method Types: ", paymentIntent.payment_method_types, "\n",
      "Confirmation Method: ", paymentIntent.confirmation_method, "\n",
      "Status: ", paymentIntent.status, "\n",
      "Canceled At: ", paymentIntent.canceled_at, "\n",
      "Created At: ", paymentIntent.created, "\n",
    );

    return checkPaymentStatus(paymentIntent);
  } catch (error) {
    console.error("Error retrieving payment intent status:", error.message);
    throw new Error(`Failed to retrieve payment intent status: ${error.message}`);
  }
}

// Function to refund a payment by paymentIntentId
async function refundPayment(paymentIntentId) {
  try {
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      throw new Error('Invalid or missing payment intent ID');
    }
    // Create a full refund for the payment intent
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId
    });
    return refund;
  } catch (error) {
    console.error('Error creating refund:', error.message);
    throw new Error(`Failed to create refund: ${error.message}`);
  }
}

// Test call
// getPaymentIntentStatus('pi_3QUNSaSDSi9maMay0u6NZ5D9')
//   .then((status) => console.log('Payment Status:', status))
//   .catch((error) => console.error('Error during test call:', error.message));

module.exports = { createPaymentIntent, getPaymentIntentStatus, refundPayment };

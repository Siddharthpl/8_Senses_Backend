const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });


console.log('[ENV DEBUG] Loaded KEY_ID:', process.env.RAZORPAY_KEY_ID);
console.log('[ENV DEBUG] Loaded KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET);


// Validate Razorpay credentials
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('Razorpay credentials are missing in environment variables');
  throw new Error('Razorpay credentials are not configured');
}

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: "rzp_test_ksEdWVO56wIwkj",
  key_secret: "IXkXi34tNLhCu0IQajf6iYNb",
});

// Test Razorpay connection
const testRazorpayConnection = async () => {
  try {
    await razorpay.orders.all({ count: 1 });
    console.log('Razorpay connection successful');
  } catch (error) {
    console.error('Razorpay connection failed:', error);
    throw new Error('Failed to connect to Razorpay. Please check your credentials.');
  }
};

// Test connection on startup
testRazorpayConnection().catch(console.error);

/**
 * Create a Razorpay order
 * @param {Object} options - Order options
 * @param {number} options.amount - Amount in smallest currency unit (paise for INR)
 * @param {string} options.currency - Currency code (default: INR)
 * @param {string} options.receipt - Receipt ID (optional)
 * @param {Object} options.notes - Additional notes (optional)
 * @returns {Promise<Object>} Razorpay order object
 */
const createOrder = async (options) => {
  try {
    const orderOptions = {
      amount: options.amount,
      currency: options.currency || 'INR',
      receipt: options.receipt || `receipt_${Date.now()}`,
      notes: options.notes || {},
      payment_capture: 1,
    };

    console.log('Creating Razorpay order with options:', orderOptions);
    const order = await razorpay.orders.create(orderOptions);
    console.log('Order created successfully:', order.id);
    return order;
  } catch (error) {
    console.error('Error creating Razorpay order:', {
      statusCode: error.statusCode,
      error: error.error,
      message: error.message
    });
    
    if (error.statusCode === 401) {
      throw new Error('Razorpay authentication failed. Please check your API credentials.');
    }
    
    throw new Error(error.message || 'Failed to create payment order');
  }
};

/**
 * Verify Razorpay payment signature
 * @param {Object} options - Verification options
 * @param {string} options.orderId - Razorpay order ID
 * @param {string} options.paymentId - Razorpay payment ID
 * @param {string} options.signature - Razorpay signature
 * @returns {boolean} Whether signature is valid
 */
const verifyPaymentSignature = (options) => {
  try {
    const signatureData = `${options.orderId}|${options.paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(signatureData)
      .digest('hex');
    
    return expectedSignature === options.signature;
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return false;
  }
};

/**
 * Get payment details from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Error fetching payment details:', error);
    throw new Error(error.message || 'Failed to fetch payment details');
  }
};

module.exports = {
  razorpay,
  createOrder,
  verifyPaymentSignature,
  getPaymentDetails
}; 
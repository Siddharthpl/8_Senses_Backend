const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
  const orderOptions = {
    amount: options.amount * 100, // Convert to paise
    currency: options.currency || 'INR',
    receipt: options.receipt || `receipt_${Date.now()}`,
    notes: options.notes || {},
    payment_capture: 1, // Auto-capture payment
  };

  try {
    const order = await razorpay.orders.create(orderOptions);
    return order;
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
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
  createOrder,
  verifyPaymentSignature,
  getPaymentDetails,
  razorpay
}; 
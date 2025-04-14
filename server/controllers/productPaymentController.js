const { validationResult, body } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const { createOrder, verifyPaymentSignature, getPaymentDetails } = require('../utils/razorpay');

// Validation rules for payment initiation
exports.validatePaymentInitiation = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Invalid order ID'),
  
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email'),
  
  body('name')
    .notEmpty()
    .withMessage('Name is required'),
  
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required'),
];

// Validation rules for payment verification
exports.validatePaymentVerification = [
  body('razorpay_order_id')
    .notEmpty()
    .withMessage('Order ID is required'),
  
  body('razorpay_payment_id')
    .notEmpty()
    .withMessage('Payment ID is required'),
  
  body('razorpay_signature')
    .notEmpty()
    .withMessage('Signature is required'),
  
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Invalid order ID'),
];

/**
 * @desc    Initiate product payment
 * @route   POST /api/payments/product
 * @access  Public
 */
exports.initiateProductPayment = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { orderId, name, email, phone } = req.body;

    // Find the order
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return next(new ErrorResponse('Order not found', 404));
    }

    // Check if order is already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'This order has already been paid'
      });
    }

    // Create Razorpay order
    const razorpayOrder = await createOrder({
      amount: order.total * 100, // Convert to paise
      currency: 'INR',
      receipt: `order_${order.orderNumber}`,
      notes: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        customerName: name,
        customerEmail: email,
        customerPhone: phone
      }
    });

    // Update order with payment details
    order.paymentStatus = 'pending';
    order.metadata = {
      razorpayOrderId: razorpayOrder.id,
      paymentGateway: 'razorpay'
    };
    await order.save();

    // Return payment information to client
    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        order: razorpayOrder,
        key: process.env.RAZORPAY_KEY_ID,
        amount: order.total,
        currency: 'INR',
        name: '8 Senses Clinic',
        description: `Payment for Order #${order.orderNumber}`,
        prefill: {
          name,
          email,
          contact: phone
        },
        notes: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber
        }
      }
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    next(error);
  }
};

/**
 * @desc    Verify product payment
 * @route   POST /api/payments/product/verify
 * @access  Public
 */
exports.verifyProductPayment = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId, customerEmail, customerPhone } = req.body;

    // Verify payment signature
    const isValidSignature = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValidSignature) {
      return next(new ErrorResponse('Invalid payment signature', 400));
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return next(new ErrorResponse('Order not found', 404));
    }

    // Get payment details from Razorpay
    const paymentDetails = await getPaymentDetails(razorpay_payment_id);

    // Update order status
    order.paymentStatus = 'paid';
    order.status = 'processing';
    order.metadata.razorpayPaymentId = razorpay_payment_id;
    order.metadata.razorpaySignature = razorpay_signature;
    await order.save();

    // Create transaction record
    const transaction = await Transaction.create({
      transactionId: razorpay_payment_id,
      order: order._id,
      user: order.user || null,
      customerName: order.customerInfo.firstName + ' ' + order.customerInfo.lastName,
      customerEmail: customerEmail || order.customerInfo.email, // Use from request or order
      customerPhone: customerPhone || order.customerInfo.phone, // Use from request or order
      amount: order.total,
      currency: 'INR',
      paymentMethod: 'razorpay',
      status: 'successful',
      paymentDetails: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        method: paymentDetails.method || 'card',
        bank: paymentDetails.bank,
        wallet: paymentDetails.wallet,
        vpa: paymentDetails.vpa,
        email: order.customerInfo.email,
        contact: order.customerInfo.phone,
        fee: paymentDetails.fee,
        tax: paymentDetails.tax,
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment successful and order confirmed',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus
        },
        transaction: {
          id: transaction._id,
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          status: transaction.status,
          date: transaction.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    next(error);
  }
}; 
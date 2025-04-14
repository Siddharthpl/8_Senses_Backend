const { validationResult, body } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const { razorpay, createOrder, verifyPaymentSignature, getPaymentDetails } = require('../utils/razorpay');
const crypto = require('crypto');

// Validation rules
exports.validatePaymentInitiation = [
  body('planId')
    .notEmpty()
    .withMessage('Subscription plan ID is required')
    .isMongoId()
    .withMessage('Invalid plan ID'),
  
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
];

/**
 * @desc    Initiate subscription payment
 * @route   POST /api/payments/subscription
 * @access  Public
 */
exports.initiateSubscriptionPayment = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { planId, name, email, phone } = req.body;

    // Find the subscription plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return next(new ErrorResponse('Subscription plan not found', 404));
    }

    // Check if plan is active
    if (plan.status !== 'active') {
      return next(new ErrorResponse('This subscription plan is not available', 400));
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      email,
      isActive: true
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active subscription',
        data: {
          planName: existingSubscription.currentTier,
          endDate: existingSubscription.endDate,
          daysRemaining: Math.max(
            0,
            Math.ceil(
              (new Date(existingSubscription.endDate) - new Date()) /
                (1000 * 60 * 60 * 24)
            )
          )
        }
      });
    }

    // Create Razorpay order
    const razorpayOrder = await createOrder({
      amount: plan.price * 100, // Convert to paise
      currency: 'INR',
      receipt: `sub_${Date.now()}`,
      notes: {
        planId: plan._id.toString(),
        planName: plan.name,
        customerName: name,
        customerEmail: email,
        customerPhone: phone
      }
    });

    // Create a pending subscription record
    const startDate = new Date();
    let endDate = new Date(startDate);
    let nextRenewalDate = new Date(startDate);

    // Calculate end date based on billing cycle
    switch (plan.billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 3);
        break;
      case 'biannual':
        endDate.setMonth(endDate.getMonth() + 6);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 6);
        break;
      case 'annual':
        endDate.setFullYear(endDate.getFullYear() + 1);
        nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    }

    // Add grace period days to end date
    if (plan.gracePeriod) {
      endDate.setDate(endDate.getDate() + plan.gracePeriod);
    }

    // Create pending subscription
    const pendingSubscription = await Subscription.create({
      name,
      email,
      phone,
      plan: planId,
      startDate,
      endDate,
      nextRenewalDate,
      currentTier: plan.name,
      paymentStatus: 'pending',
      isActive: false, // Will be set to true after payment verification
      autoRenew: true,
      paymentHistory: [
        {
          amount: plan.price,
          status: 'pending',
          paymentMethod: 'razorpay',
          transactionId: razorpayOrder.id,
          date: Date.now()
        }
      ],
      metadata: {
        razorpayOrderId: razorpayOrder.id
      }
    });

    // Return payment information to client
    res.status(200).json({
      success: true,
      data: {
        subscriptionId: pendingSubscription._id,
        order: razorpayOrder,
        key: process.env.RAZORPAY_KEY_ID,
        amount: plan.price,
        currency: 'INR',
        name: '8 Senses Clinic',
        description: `Subscription to ${plan.name} Plan`,
        prefill: {
          name,
          email,
          contact: phone
        },
        notes: {
          planId: plan._id.toString(),
          planName: plan.name,
          subscriptionId: pendingSubscription._id.toString()
        }
      }
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    next(error);
  }
};

/**
 * @desc    Verify subscription payment
 * @route   POST /api/payments/subscription/verify
 * @access  Public
 */
exports.verifySubscriptionPayment = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId } = req.body;

    // Verify payment signature
    const isValidSignature = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValidSignature) {
      return next(new ErrorResponse('Invalid payment signature', 400));
    }

    // Find the subscription
    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      'metadata.razorpayOrderId': razorpay_order_id
    }).populate('plan');

    if (!subscription) {
      return next(new ErrorResponse('Subscription not found', 404));
    }

    // Get payment details from Razorpay
    const paymentDetails = await getPaymentDetails(razorpay_payment_id);

    // Update subscription status
    subscription.paymentStatus = 'paid';
    subscription.isActive = true;
    
    // Update payment history
    const paymentIndex = subscription.paymentHistory.findIndex(
      payment => payment.transactionId === razorpay_order_id
    );
    
    if (paymentIndex !== -1) {
      subscription.paymentHistory[paymentIndex].status = 'successful';
      subscription.paymentHistory[paymentIndex].transactionId = razorpay_payment_id;
    } else {
      subscription.paymentHistory.push({
        amount: subscription.plan.price,
        status: 'successful',
        paymentMethod: 'razorpay',
        transactionId: razorpay_payment_id,
        date: Date.now()
      });
    }

    await subscription.save();

    // Create transaction record
    const transaction = await Transaction.create({
      transactionId: razorpay_payment_id,
      order: subscription._id,
      user: req.user ? req.user._id : null, // Optional user field
      customerName: subscription.name,
      customerEmail: subscription.email,
      customerPhone: subscription.phone,
      amount: subscription.plan.price,
      currency: paymentDetails.currency || 'INR',
      paymentMethod: 'razorpay',
      status: 'successful',
      paymentDetails: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        method: paymentDetails.method || 'card',
        bank: paymentDetails.bank,
        wallet: paymentDetails.wallet,
        vpa: paymentDetails.vpa,
        email: subscription.email,
        contact: subscription.phone,
        fee: paymentDetails.fee,
        tax: paymentDetails.tax,
      },
      metadata: {
        subscriptionId: subscription._id,
        planName: subscription.plan.name,
        billingCycle: subscription.plan.billingCycle
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment successful and subscription activated',
      data: {
        subscription: {
          id: subscription._id,
          planName: subscription.currentTier,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          isActive: subscription.isActive
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

/**
 * @desc    Cancel subscription
 * @route   POST /api/payments/subscription/:id/cancel
 * @access  Private
 */
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return next(new ErrorResponse('Subscription not found', 404));
    }

    // Check if user is authorized to cancel
    if (req.user.role !== 'admin' && req.user.email !== subscription.email) {
      return next(new ErrorResponse('Not authorized to cancel this subscription', 403));
    }

    // Update subscription
    subscription.isActive = false;
    subscription.paymentStatus = 'cancelled';
    subscription.autoRenew = false;
    
    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    
    const order = await createOrder({
      amount: amount * 100, // Convert to paise
      currency,
      receipt,
      notes
    });

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
}; 
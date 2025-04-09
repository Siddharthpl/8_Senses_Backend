const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  initiateSubscriptionPayment,
  verifySubscriptionPayment,
  cancelSubscription,
  validatePaymentInitiation: validateSubscriptionPaymentInitiation,
  validatePaymentVerification: validateSubscriptionPaymentVerification
} = require('../controllers/paymentController');

const {
  initiateProductPayment,
  verifyProductPayment,
  validatePaymentInitiation: validateProductPaymentInitiation,
  validatePaymentVerification: validateProductPaymentVerification
} = require('../controllers/productPaymentController');

const router = express.Router();

// Public routes for subscription payment
router.post('/subscription', validateSubscriptionPaymentInitiation, initiateSubscriptionPayment);
router.post('/subscription/verify', validateSubscriptionPaymentVerification, verifySubscriptionPayment);

// Protected routes
router.post('/subscription/:id/cancel', protect, cancelSubscription);

// Product payment routes
router.post('/product', validateProductPaymentInitiation, initiateProductPayment);
router.post('/product/verify', validateProductPaymentVerification, verifyProductPayment);

module.exports = router; 
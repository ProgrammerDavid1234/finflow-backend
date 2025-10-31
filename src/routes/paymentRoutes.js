// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticateToken = require('../middleware/auth');

// Webhook endpoint (NO AUTH - Stripe calls this)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// All other routes require authentication
router.use(authenticateToken);

// POST /api/payment/create-intent - Create payment intent for top-up
router.post('/create-intent', paymentController.createTopUpIntent);

// POST /api/payment/confirm - Confirm payment and update balance
router.post('/confirm', paymentController.confirmTopUp);

// GET /api/payment/status/:paymentIntentId - Get payment status
router.get('/status/:paymentIntentId', paymentController.getPaymentStatus);

// GET /api/payment/currencies - Get supported currencies for payments
router.get('/currencies', paymentController.getSupportedCurrencies);

module.exports = router;
// src/routes/paymentRequest.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const paymentRequestController = require('../controllers/paymentRequestController');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/payment-request
 * @desc    Create a new payment request
 * @access  Private
 * @body    { amount, currency, type, recipientMethod, recipientValue, note, ... }
 */
router.post('/', paymentRequestController.createPaymentRequest);

/**
 * @route   GET /api/payment-request/my-requests
 * @desc    Get all payment requests created by user
 * @access  Private
 * @query   ?status=pending&page=1&limit=20
 */
router.get('/my-requests', paymentRequestController.getMyPaymentRequests);

/**
 * @route   GET /api/payment-request/stats
 * @desc    Get payment request statistics
 * @access  Private
 * @query   ?period=week|month|year
 */
router.get('/stats', paymentRequestController.getPaymentRequestStats);

/**
 * @route   GET /api/payment-request/recent-payers
 * @desc    Get recent people who paid your requests
 * @access  Private
 * @query   ?limit=10
 */
router.get('/recent-payers', paymentRequestController.getRecentPayers);

/**
 * @route   GET /api/payment-request/:requestId
 * @desc    Get payment request details by request ID
 * @access  Private
 */
router.get('/:requestId', paymentRequestController.getPaymentRequest);

/**
 * @route   POST /api/payment-request/:requestId/pay
 * @desc    Pay a payment request
 * @access  Private
 * @body    { recipientIdentifier }
 */
router.post('/:requestId/pay', paymentRequestController.payPaymentRequest);

/**
 * @route   POST /api/payment-request/:requestId/resend
 * @desc    Resend payment request notification
 * @access  Private
 */
router.post('/:requestId/resend', paymentRequestController.resendPaymentRequest);

/**
 * @route   DELETE /api/payment-request/:requestId
 * @desc    Cancel a payment request
 * @access  Private
 */
router.delete('/:requestId', paymentRequestController.cancelPaymentRequest);

module.exports = router;
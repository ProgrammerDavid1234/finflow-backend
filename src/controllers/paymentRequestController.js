// src/controllers/paymentRequestController.js
const paymentRequestService = require('../service/paymentRequestService');
const { convertCurrency } = require('../service/currencyService');

/**
 * Create a new payment request
 * POST /api/payment-request
 */
exports.createPaymentRequest = async (req, res) => {
    try {
        const {
            amount,
            currency,
            type,
            cryptoSymbol,
            recipientMethod,
            recipientValue,
            note,
            isRecurring,
            recurringFrequency,
            isSplit,
            splitRecipients,
            expiresInHours
        } = req.body;

        // Validate required fields
        if (!amount || !recipientMethod || (!recipientValue && !isSplit)) {
            return res.status(400).json({
                success: false,
                error: 'Amount and recipient details are required'
            });
        }

        if (type === 'crypto' && !cryptoSymbol) {
            return res.status(400).json({
                success: false,
                error: 'Crypto symbol is required for crypto requests'
            });
        }

        const result = await paymentRequestService.createPaymentRequest(req.userId, {
            amount,
            currency: currency || 'USD',
            type: type || 'money',
            cryptoSymbol,
            recipientMethod,
            recipientValue,
            note,
            isRecurring,
            recurringFrequency,
            isSplit,
            splitRecipients,
            expiresInHours: expiresInHours || 168 // 7 days default
        });

        res.status(201).json({
            success: true,
            message: 'Payment request created successfully',
            paymentRequest: result.paymentRequest,
            paymentLink: result.paymentLink
        });
    } catch (error) {
        console.error('Create payment request error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create payment request'
        });
    }
};

/**
 * Get payment request by ID
 * GET /api/payment-request/:requestId
 */
exports.getPaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        const paymentRequest = await paymentRequestService.getPaymentRequest(requestId);

        res.json({
            success: true,
            paymentRequest
        });
    } catch (error) {
        console.error('Get payment request error:', error);
        
        if (error.message === 'Payment request not found') {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment request'
        });
    }
};

/**
 * Get all payment requests for logged-in user
 * GET /api/payment-request/my-requests
 */
exports.getMyPaymentRequests = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const result = await paymentRequestService.getUserPaymentRequests(req.userId, {
            status,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            requests: result.requests,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get my payment requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment requests'
        });
    }
};

/**
 * Pay a payment request
 * POST /api/payment-request/:requestId/pay
 */
exports.payPaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { recipientIdentifier } = req.body;

        if (!recipientIdentifier) {
            return res.status(400).json({
                success: false,
                error: 'Recipient identifier is required'
            });
        }

        const result = await paymentRequestService.payPaymentRequest(
            requestId,
            req.userId,
            recipientIdentifier
        );

        res.json({
            success: true,
            message: 'Payment completed successfully',
            paymentRequest: result.paymentRequest,
            transaction: result.transaction,
            newBalance: result.newBalance
        });
    } catch (error) {
        console.error('Pay payment request error:', error);

        if (error.message.includes('not found') || 
            error.message.includes('expired') ||
            error.message.includes('already')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        if (error.message.includes('Insufficient balance')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Payment failed'
        });
    }
};

/**
 * Cancel a payment request
 * DELETE /api/payment-request/:requestId
 */
exports.cancelPaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await paymentRequestService.cancelPaymentRequest(requestId, req.userId);

        res.json({
            success: true,
            message: 'Payment request cancelled successfully',
            paymentRequest: result.paymentRequest
        });
    } catch (error) {
        console.error('Cancel payment request error:', error);

        if (error.message.includes('not found') || 
            error.message.includes('Not authorized') ||
            error.message.includes('Cannot cancel')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to cancel payment request'
        });
    }
};

/**
 * Get payment request statistics
 * GET /api/payment-request/stats
 */
exports.getPaymentRequestStats = async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        const stats = await paymentRequestService.getPaymentRequestStats(req.userId, period);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get payment request stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
};

/**
 * Get recent payers
 * GET /api/payment-request/recent-payers
 */
exports.getRecentPayers = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const payers = await paymentRequestService.getRecentPayers(req.userId, parseInt(limit));

        res.json({
            success: true,
            payers,
            count: payers.length
        });
    } catch (error) {
        console.error('Get recent payers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent payers'
        });
    }
};

/**
 * Resend payment request
 * POST /api/payment-request/:requestId/resend
 */
exports.resendPaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await paymentRequestService.resendPaymentRequest(requestId, req.userId);

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Resend payment request error:', error);

        if (error.message.includes('not found') || 
            error.message.includes('Not authorized') ||
            error.message.includes('Cannot resend')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to resend payment request'
        });
    }
};
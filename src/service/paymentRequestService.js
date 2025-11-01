// src/service/paymentRequestService.js
const PaymentRequest = require('../models/PaymentRequest');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { convertCurrency } = require('./currencyService');
const crypto = require('crypto');

class PaymentRequestService {
    /**
     * Create a new payment request
     */
    async createPaymentRequest(requesterId, requestData) {
        try {
            const {
                amount,
                currency,
                type, // 'money' or 'crypto'
                cryptoSymbol,
                recipientMethod, // 'email', 'phone', 'username'
                recipientValue,
                note,
                isRecurring,
                recurringFrequency,
                isSplit,
                splitRecipients,
                expiresInHours
            } = requestData;

            // Validate amount
            const numericAmount = parseFloat(amount);
            if (isNaN(numericAmount) || numericAmount <= 0) {
                throw new Error('Invalid request amount');
            }

            // Get requester details
            const requester = await User.findById(requesterId);
            if (!requester) {
                throw new Error('Requester not found');
            }

            // Generate unique request ID and payment link
            const requestId = crypto.randomBytes(16).toString('hex');
            const paymentLink = `finflow.app/pay/${requestId}`;

            // Calculate expiration
            const expiresAt = expiresInHours 
                ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

            // Prepare recipients array
            let recipients = [];
            if (isSplit && splitRecipients && splitRecipients.length > 0) {
                // Split payment request
                const amountPerPerson = numericAmount / splitRecipients.length;
                recipients = splitRecipients.map(recipient => ({
                    method: recipientMethod,
                    value: recipient.value || recipient,
                    name: recipient.name || '',
                    amountDue: amountPerPerson,
                    status: 'pending'
                }));
            } else {
                // Single recipient
                recipients = [{
                    method: recipientMethod,
                    value: recipientValue,
                    name: '',
                    amountDue: numericAmount,
                    status: 'pending'
                }];
            }

            // Create payment request
            const paymentRequest = new PaymentRequest({
                requesterId: requesterId,
                requesterName: requester.fullName || requester.email,
                requesterEmail: requester.email,
                requestId,
                amount: numericAmount,
                currency: currency || 'USD',
                type,
                cryptoSymbol: type === 'crypto' ? cryptoSymbol : null,
                recipients,
                note: note || '',
                isRecurring: isRecurring || false,
                recurringFrequency: recurringFrequency || null,
                isSplit: isSplit || false,
                paymentLink,
                status: 'pending',
                expiresAt
            });

            await paymentRequest.save();

            return {
                success: true,
                paymentRequest,
                paymentLink
            };
        } catch (error) {
            console.error('Create payment request error:', error);
            throw error;
        }
    }

    /**
     * Get payment request by ID
     */
    async getPaymentRequest(requestId) {
        try {
            const paymentRequest = await PaymentRequest.findOne({ requestId })
                .populate('requesterId', 'fullName email profileImage');

            if (!paymentRequest) {
                throw new Error('Payment request not found');
            }

            return paymentRequest;
        } catch (error) {
            console.error('Get payment request error:', error);
            throw error;
        }
    }

    /**
     * Get all payment requests for a user
     */
    async getUserPaymentRequests(userId, { status, page = 1, limit = 20 }) {
        try {
            const filter = { requesterId: userId };
            if (status) {
                filter.status = status;
            }

            const requests = await PaymentRequest.find(filter)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            const total = await PaymentRequest.countDocuments(filter);

            return {
                requests,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get user payment requests error:', error);
            throw error;
        }
    }

    /**
     * Pay a payment request
     */
    async payPaymentRequest(requestId, payerId, recipientIdentifier) {
        try {
            const paymentRequest = await PaymentRequest.findOne({ requestId });
            if (!paymentRequest) {
                throw new Error('Payment request not found');
            }

            // Check if expired
            if (paymentRequest.expiresAt && new Date() > paymentRequest.expiresAt) {
                throw new Error('Payment request has expired');
            }

            // Check if already completed
            if (paymentRequest.status === 'completed') {
                throw new Error('Payment request already completed');
            }

            // Get payer
            const payer = await User.findById(payerId);
            if (!payer) {
                throw new Error('Payer not found');
            }

            // Get requester
            const requester = await User.findById(paymentRequest.requesterId);
            if (!requester) {
                throw new Error('Requester not found');
            }

            // Find recipient in the request
            const recipient = paymentRequest.recipients.find(
                r => r.value === recipientIdentifier || r.method === 'all'
            );

            if (!recipient) {
                throw new Error('You are not authorized to pay this request');
            }

            // Check if already paid by this recipient
            if (recipient.status === 'completed') {
                throw new Error('You have already paid this request');
            }

            const amountToPay = recipient.amountDue;
            const currency = paymentRequest.currency;

            // Convert to USD for balance check
            const amountInUSD = await convertCurrency(amountToPay, currency, 'USD');

            // Check payer's balance
            if (payer.balanceUSD < amountInUSD) {
                const availableInCurrency = await convertCurrency(payer.balanceUSD, 'USD', currency);
                throw new Error(`Insufficient balance. Available: ${availableInCurrency.toFixed(2)} ${currency}`);
            }

            // Process payment
            payer.balanceUSD = parseFloat(payer.balanceUSD) - parseFloat(amountInUSD);
            requester.balanceUSD = parseFloat(requester.balanceUSD) + parseFloat(amountInUSD);

            await payer.save();
            await requester.save();

            // Create transactions
            const payerTransaction = new Transaction({
                userId: payer._id,
                type: 'send',
                amount: amountToPay,
                amountUSD: amountInUSD,
                currency: currency,
                recipient: {
                    name: requester.fullName || 'Unknown',
                    email: requester.email
                },
                description: `Payment request: ${paymentRequest.note || 'No description'}`,
                status: 'completed',
                balanceAfter: payer.balanceUSD,
                metadata: {
                    paymentRequestId: paymentRequest._id.toString(),
                    requestId: requestId
                }
            });

            const requesterTransaction = new Transaction({
                userId: requester._id,
                type: 'receive',
                amount: amountToPay,
                amountUSD: amountInUSD,
                currency: currency,
                recipient: {
                    name: payer.fullName || 'Unknown',
                    email: payer.email
                },
                description: `Payment received: ${paymentRequest.note || 'No description'}`,
                status: 'completed',
                balanceAfter: requester.balanceUSD,
                metadata: {
                    paymentRequestId: paymentRequest._id.toString(),
                    requestId: requestId
                }
            });

            await payerTransaction.save();
            await requesterTransaction.save();

            // Update recipient status
            recipient.status = 'completed';
            recipient.paidBy = payer._id;
            recipient.paidAt = new Date();
            recipient.transactionId = payerTransaction._id;

            paymentRequest.amountPaid += amountToPay;

            // Check if all recipients have paid
            const allPaid = paymentRequest.recipients.every(r => r.status === 'completed');
            if (allPaid) {
                paymentRequest.status = 'completed';
                paymentRequest.completedAt = new Date();
            } else {
                paymentRequest.status = 'partial';
            }

            await paymentRequest.save();

            return {
                success: true,
                paymentRequest,
                transaction: payerTransaction,
                newBalance: payer.balanceUSD
            };
        } catch (error) {
            console.error('Pay payment request error:', error);
            throw error;
        }
    }

    /**
     * Cancel a payment request
     */
    async cancelPaymentRequest(requestId, userId) {
        try {
            const paymentRequest = await PaymentRequest.findOne({ requestId });
            
            if (!paymentRequest) {
                throw new Error('Payment request not found');
            }

            // Only requester can cancel
            if (paymentRequest.requesterId.toString() !== userId.toString()) {
                throw new Error('Not authorized to cancel this request');
            }

            // Can't cancel completed requests
            if (paymentRequest.status === 'completed') {
                throw new Error('Cannot cancel completed payment request');
            }

            paymentRequest.status = 'cancelled';
            paymentRequest.cancelledAt = new Date();
            await paymentRequest.save();

            return {
                success: true,
                paymentRequest
            };
        } catch (error) {
            console.error('Cancel payment request error:', error);
            throw error;
        }
    }

    /**
     * Get payment request statistics
     */
    async getPaymentRequestStats(userId, period = 'month') {
        try {
            const now = new Date();
            let startDate;

            switch (period) {
                case 'week':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            }

            const requests = await PaymentRequest.find({
                requesterId: userId,
                createdAt: { $gte: startDate }
            });

            let totalRequested = 0;
            let totalReceived = 0;
            let pendingAmount = 0;
            const statusCount = {
                pending: 0,
                partial: 0,
                completed: 0,
                cancelled: 0,
                expired: 0
            };

            requests.forEach(request => {
                totalRequested += request.amount;
                totalReceived += request.amountPaid;

                if (request.status === 'pending' || request.status === 'partial') {
                    pendingAmount += (request.amount - request.amountPaid);
                }

                statusCount[request.status] = (statusCount[request.status] || 0) + 1;
            });

            return {
                totalRequested,
                totalReceived,
                pendingAmount,
                totalRequests: requests.length,
                statusCount,
                period
            };
        } catch (error) {
            console.error('Get payment request stats error:', error);
            throw error;
        }
    }

    /**
     * Get recent payers for a user
     */
    async getRecentPayers(userId, limit = 10) {
        try {
            const requests = await PaymentRequest.find({
                requesterId: userId,
                status: { $in: ['completed', 'partial'] }
            })
            .sort({ updatedAt: -1 })
            .limit(50);

            const payerIds = new Set();
            requests.forEach(request => {
                request.recipients.forEach(recipient => {
                    if (recipient.paidBy) {
                        payerIds.add(recipient.paidBy.toString());
                    }
                });
            });

            const payers = await User.find({
                _id: { $in: Array.from(payerIds) }
            })
            .select('fullName email phoneNumber profileImage')
            .limit(limit);

            return payers.map(payer => ({
                id: payer._id,
                name: payer.fullName || 'Unknown User',
                email: payer.email,
                phone: payer.phoneNumber,
                profileImage: payer.profileImage
            }));
        } catch (error) {
            console.error('Get recent payers error:', error);
            throw error;
        }
    }

    /**
     * Resend payment request notification
     */
    async resendPaymentRequest(requestId, userId) {
        try {
            const paymentRequest = await PaymentRequest.findOne({ requestId });
            
            if (!paymentRequest) {
                throw new Error('Payment request not found');
            }

            // Only requester can resend
            if (paymentRequest.requesterId.toString() !== userId.toString()) {
                throw new Error('Not authorized to resend this request');
            }

            // Can't resend completed or cancelled requests
            if (['completed', 'cancelled'].includes(paymentRequest.status)) {
                throw new Error(`Cannot resend ${paymentRequest.status} payment request`);
            }

            // Update last sent timestamp
            paymentRequest.lastSentAt = new Date();
            await paymentRequest.save();

            // TODO: Send email/SMS notifications to recipients

            return {
                success: true,
                message: 'Payment request resent successfully'
            };
        } catch (error) {
            console.error('Resend payment request error:', error);
            throw error;
        }
    }
}

module.exports = new PaymentRequestService();
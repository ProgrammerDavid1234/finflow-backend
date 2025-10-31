// controllers/paymentController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { 
    createPaymentIntent, 
    confirmPayment, 
    getPaymentDetails,
    getMinimumAmount 
} = require('../service/paymentService');
const { convertCurrency } = require('../service/currencyService');

// Create payment intent for top-up
exports.createTopUpIntent = async (req, res) => {
    try {
        const { amount, currency } = req.body;

        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                error: 'Amount and currency are required'
            });
        }

        const numericAmount = parseFloat(amount);

        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        // Validate currency
        const validCurrencies = ['USD', 'EUR', 'GBP', 'NGN'];
        if (!validCurrencies.includes(currency.toUpperCase())) {
            return res.status(400).json({
                success: false,
                error: `Unsupported currency. Supported: ${validCurrencies.join(', ')}`
            });
        }

        // Check minimum amount
        const minAmount = getMinimumAmount(currency);
        if (numericAmount < minAmount) {
            return res.status(400).json({
                success: false,
                error: `Minimum top-up amount for ${currency} is ${minAmount}`
            });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Create payment intent with Stripe
        const paymentResult = await createPaymentIntent(
            numericAmount,
            currency,
            req.userId,
            {
                type: 'topup',
                userEmail: user.email,
                userName: user.fullName
            }
        );

        if (!paymentResult.success) {
            return res.status(400).json({
                success: false,
                error: paymentResult.error
            });
        }

        // Create pending transaction
        const amountInUSD = await convertCurrency(numericAmount, currency, 'USD');

        const transaction = new Transaction({
            userId: req.userId,
            type: 'topup',
            amount: numericAmount,
            currency: currency,
            amountUSD: amountInUSD,
            status: 'pending',
            description: `Top up via card payment (${currency})`,
            transactionHash: paymentResult.paymentIntentId,
        });

        await transaction.save();

        res.json({
            success: true,
            clientSecret: paymentResult.clientSecret,
            paymentIntentId: paymentResult.paymentIntentId,
            transactionId: transaction._id,
            amount: numericAmount,
            currency: currency,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        });
    } catch (error) {
        console.error('Create top-up intent error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create payment intent'
        });
    }
};

// Confirm payment and update balance
exports.confirmTopUp = async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                error: 'Payment intent ID is required'
            });
        }

        // Verify payment with Stripe
        const paymentResult = await confirmPayment(paymentIntentId);

        if (!paymentResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Payment verification failed'
            });
        }

        // Find the transaction
        const transaction = await Transaction.findOne({
            userId: req.userId,
            transactionHash: paymentIntentId,
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        // Check if already processed
        if (transaction.status === 'completed') {
            return res.json({
                success: true,
                message: 'Transaction already processed',
                alreadyProcessed: true,
            });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update user balance
        const amountInUSD = transaction.amountUSD;
        user.balanceUSD = parseFloat(user.balanceUSD) + parseFloat(amountInUSD);
        await user.save();

        // Update transaction status
        transaction.status = 'completed';
        transaction.balanceAfter = user.balanceUSD;
        await transaction.save();

        // Get balance in user's preferred currency
        const balanceInPreferredCurrency = await user.getBalanceInCurrency(user.currency);

        res.json({
            success: true,
            message: 'Top-up successful!',
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                currency: transaction.currency,
                amountUSD: transaction.amountUSD,
                status: transaction.status,
                createdAt: transaction.createdAt,
            },
            newBalance: balanceInPreferredCurrency,
            newBalanceUSD: user.balanceUSD,
            currency: user.currency,
        });
    } catch (error) {
        console.error('Confirm top-up error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to confirm payment'
        });
    }
};

// Get payment status
exports.getPaymentStatus = async (req, res) => {
    try {
        const { paymentIntentId } = req.params;

        const paymentResult = await getPaymentDetails(paymentIntentId);

        if (!paymentResult.success) {
            return res.status(400).json({
                success: false,
                error: paymentResult.error
            });
        }

        // Find associated transaction
        const transaction = await Transaction.findOne({
            userId: req.userId,
            transactionHash: paymentIntentId,
        });

        res.json({
            success: true,
            payment: paymentResult.paymentIntent,
            transaction: transaction ? {
                id: transaction._id,
                status: transaction.status,
                amount: transaction.amount,
                currency: transaction.currency,
            } : null
        });
    } catch (error) {
        console.error('Get payment status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment status'
        });
    }
};

// Get supported currencies and minimum amounts
exports.getSupportedCurrencies = async (req, res) => {
    try {
        const currencies = [
            {
                code: 'USD',
                name: 'US Dollar',
                symbol: '$',
                flag: '🇺🇸',
                minAmount: getMinimumAmount('USD'),
            },
            {
                code: 'EUR',
                name: 'Euro',
                symbol: '€',
                flag: '🇪🇺',
                minAmount: getMinimumAmount('EUR'),
            },
            {
                code: 'GBP',
                name: 'British Pound',
                symbol: '£',
                flag: '🇬🇧',
                minAmount: getMinimumAmount('GBP'),
            },
            {
                code: 'NGN',
                name: 'Nigerian Naira',
                symbol: '₦',
                flag: '🇳🇬',
                minAmount: getMinimumAmount('NGN'),
            },
        ];

        res.json({
            success: true,
            currencies: currencies,
        });
    } catch (error) {
        console.error('Get supported currencies error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get supported currencies'
        });
    }
};

// Handle Stripe webhook (for production)
exports.handleWebhook = async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                console.log('PaymentIntent succeeded:', paymentIntent.id);
                
                // Auto-confirm payment (backup for mobile confirmation)
                const transaction = await Transaction.findOne({
                    transactionHash: paymentIntent.id,
                });

                if (transaction && transaction.status === 'pending') {
                    const user = await User.findById(transaction.userId);
                    if (user) {
                        user.balanceUSD = parseFloat(user.balanceUSD) + parseFloat(transaction.amountUSD);
                        await user.save();

                        transaction.status = 'completed';
                        transaction.balanceAfter = user.balanceUSD;
                        await transaction.save();
                        
                        console.log('Balance updated via webhook for user:', user._id);
                    }
                }
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                console.log('PaymentIntent failed:', failedPayment.id);
                
                // Mark transaction as failed
                const failedTransaction = await Transaction.findOne({
                    transactionHash: failedPayment.id,
                });

                if (failedTransaction) {
                    failedTransaction.status = 'failed';
                    await failedTransaction.save();
                }
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
};
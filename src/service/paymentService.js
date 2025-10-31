// services/paymentService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Convert currency code to Stripe's format
const getStripeCurrency = (currency) => {
    // Stripe uses lowercase currency codes
    return currency.toLowerCase();
};

// Get minimum amount for currency (Stripe requirements)
const getMinimumAmount = (currency) => {
    const minimums = {
        usd: 0.50,  // $0.50
        eur: 0.50,  // €0.50
        gbp: 0.30,  // £0.30
        ngn: 100,   // ₦100
    };
    return minimums[currency.toLowerCase()] || 1;
};

// Create payment intent
const createPaymentIntent = async (amount, currency, userId, metadata = {}) => {
    try {
        // Validate amount
        const numericAmount = parseFloat(amount);
        const minAmount = getMinimumAmount(currency);
        
        if (numericAmount < minAmount) {
            throw new Error(`Minimum amount for ${currency.toUpperCase()} is ${minAmount}`);
        }

        // Stripe requires amounts in cents (smallest currency unit)
        // For NGN, 1 Naira = 100 Kobo, so multiply by 100
        // For USD, EUR, GBP: multiply by 100 for cents
        const amountInCents = Math.round(numericAmount * 100);

const paymentIntent = await stripe.paymentIntents.create({
  amount: amountInCents,
  currency: getStripeCurrency(currency),
  automatic_payment_methods: {
    enabled: true,
    allow_redirects: 'never', // 🚫 prevents Stripe from requiring return_url
  },
  metadata: {
    userId: userId.toString(),
    originalAmount: numericAmount,
    originalCurrency: currency,
    ...metadata,
  },
});

        return {
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: numericAmount,
            currency: currency,
        };
    } catch (error) {
        console.error('Create payment intent error:', error);
        return {
            success: false,
            error: error.message || 'Failed to create payment intent'
        };
    }
};

// Confirm payment
const confirmPayment = async (paymentIntentId) => {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        return {
            success: paymentIntent.status === 'succeeded',
            status: paymentIntent.status,
            amount: paymentIntent.amount / 100, // Convert back from cents
            currency: paymentIntent.currency.toUpperCase(),
            paymentIntentId: paymentIntent.id,
            metadata: paymentIntent.metadata,
        };
    } catch (error) {
        console.error('Confirm payment error:', error);
        return {
            success: false,
            error: error.message || 'Failed to confirm payment'
        };
    }
};

// Get payment details
const getPaymentDetails = async (paymentIntentId) => {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        return {
            success: true,
            paymentIntent: {
                id: paymentIntent.id,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency.toUpperCase(),
                status: paymentIntent.status,
                created: new Date(paymentIntent.created * 1000),
                metadata: paymentIntent.metadata,
            }
        };
    } catch (error) {
        console.error('Get payment details error:', error);
        return {
            success: false,
            error: error.message || 'Failed to get payment details'
        };
    }
};

// Refund payment (for admin or user request)
const refundPayment = async (paymentIntentId, amount = null) => {
    try {
        const refundData = {
            payment_intent: paymentIntentId,
        };

        // Partial refund if amount specified
        if (amount) {
            refundData.amount = Math.round(parseFloat(amount) * 100);
        }

        const refund = await stripe.refunds.create(refundData);

        return {
            success: refund.status === 'succeeded',
            refundId: refund.id,
            amount: refund.amount / 100,
            currency: refund.currency.toUpperCase(),
            status: refund.status,
        };
    } catch (error) {
        console.error('Refund payment error:', error);
        return {
            success: false,
            error: error.message || 'Failed to refund payment'
        };
    }
};

// Get customer payment methods (for saved cards)
const getCustomerPaymentMethods = async (customerId) => {
    try {
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });

        return {
            success: true,
            paymentMethods: paymentMethods.data.map(pm => ({
                id: pm.id,
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
            }))
        };
    } catch (error) {
        console.error('Get payment methods error:', error);
        return {
            success: false,
            error: error.message || 'Failed to get payment methods'
        };
    }
};

// Create Stripe customer (for future saved cards feature)
const createCustomer = async (email, userId, name = '') => {
    try {
        const customer = await stripe.customers.create({
            email,
            name,
            metadata: {
                userId: userId.toString(),
            }
        });

        return {
            success: true,
            customerId: customer.id,
        };
    } catch (error) {
        console.error('Create customer error:', error);
        return {
            success: false,
            error: error.message || 'Failed to create customer'
        };
    }
};

// Handle webhook events (for production)
const handleWebhook = async (event) => {
    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                // Payment succeeded - update balance
                console.log('Payment succeeded:', event.data.object.id);
                return { success: true, type: 'payment_succeeded' };

            case 'payment_intent.payment_failed':
                // Payment failed
                console.log('Payment failed:', event.data.object.id);
                return { success: true, type: 'payment_failed' };

            case 'charge.refunded':
                // Refund processed
                console.log('Charge refunded:', event.data.object.id);
                return { success: true, type: 'refund_processed' };

            default:
                console.log('Unhandled event type:', event.type);
                return { success: true, type: 'unhandled' };
        }
    } catch (error) {
        console.error('Webhook error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    createPaymentIntent,
    confirmPayment,
    getPaymentDetails,
    refundPayment,
    getCustomerPaymentMethods,
    createCustomer,
    handleWebhook,
    getMinimumAmount,
};
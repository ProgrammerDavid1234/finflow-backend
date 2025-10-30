const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['send', 'receive', 'topup', 'bill', 'exchange', 'withdrawal'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    // Amount in USD for consistent balance tracking
    amountUSD: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH'],
    },
    // Exchange rate at time of transaction (for historical accuracy)
    exchangeRate: {
        type: Number,
        default: 1,
    },
    recipient: {
        name: String,
        email: String,
        phone: String,
        walletAddress: String,
    },
    description: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'completed',
    },
    transactionHash: {
        type: String,
        default: '',
    },
    fee: {
        type: Number,
        default: 0,
    },
    // Balance after transaction (in USD)
    balanceAfter: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Index for faster queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });

// Pre-save hook to calculate amountUSD if not provided
transactionSchema.pre('save', async function(next) {
    if (!this.amountUSD) {
        const { convertCurrency } = require('../services/currencyService');
        this.amountUSD = await convertCurrency(this.amount, this.currency, 'USD');
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
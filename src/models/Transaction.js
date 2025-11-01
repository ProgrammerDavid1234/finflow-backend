// src/models/Transaction.js - Updated with transfer metadata
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
    // ========== NEW: TRANSFER-SPECIFIC METADATA ==========
    metadata: {
        // Transfer method used
        transferMethod: {
            type: String,
            enum: ['account', 'phone', 'contact', 'wallet'],
            default: 'account'
        },
        // For linking sender and recipient transactions
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        // For grouping related transactions
        transferId: String,
        // Additional transfer notes
        notes: String,
        // IP address for security
        ipAddress: String,
        // Device info
        deviceInfo: String
    }
}, {
    timestamps: true,
});

// Indexes for faster queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ 'metadata.recipientId': 1 });
transactionSchema.index({ 'metadata.senderId': 1 });
transactionSchema.index({ 'metadata.transferId': 1 });

// Pre-save hook to calculate amountUSD if not provided
transactionSchema.pre('save', async function(next) {
    if (!this.amountUSD) {
        const { convertCurrency } = require('../service/currencyService');
        this.amountUSD = await convertCurrency(this.amount, this.currency, 'USD');
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
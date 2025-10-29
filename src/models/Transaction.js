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
    currency: {
        type: String,
        default: 'USD',
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

module.exports = mongoose.model('Transaction', transactionSchema);
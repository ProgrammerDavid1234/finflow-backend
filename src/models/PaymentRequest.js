// src/models/PaymentRequest.js
const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
    method: {
        type: String,
        enum: ['email', 'phone', 'username'],
        required: true
    },
    value: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: ''
    },
    amountDue: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'declined'],
        default: 'pending'
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    paidAt: Date,
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }
}, { _id: false });

const paymentRequestSchema = new mongoose.Schema({
    requesterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    requesterName: {
        type: String,
        required: true
    },
    requesterEmail: {
        type: String,
        required: true
    },
    requestId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    amountPaid: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH']
    },
    type: {
        type: String,
        enum: ['money', 'crypto'],
        default: 'money'
    },
    cryptoSymbol: {
        type: String,
        enum: ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', null],
        default: null
    },
    recipients: [recipientSchema],
    note: {
        type: String,
        default: ''
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly', null],
        default: null
    },
    isSplit: {
        type: Boolean,
        default: false
    },
    paymentLink: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'partial', 'completed', 'cancelled', 'expired'],
        default: 'pending',
        index: true
    },
    expiresAt: {
        type: Date
    },
    completedAt: Date,
    cancelledAt: Date,
    lastSentAt: Date
}, {
    timestamps: true
});

// Indexes for faster queries
paymentRequestSchema.index({ requesterId: 1, createdAt: -1 });
paymentRequestSchema.index({ requestId: 1 });
paymentRequestSchema.index({ status: 1 });
paymentRequestSchema.index({ expiresAt: 1 });

// Virtual for checking if expired
paymentRequestSchema.virtual('isExpired').get(function() {
    return this.expiresAt && new Date() > this.expiresAt;
});

// Pre-save hook to check expiration
paymentRequestSchema.pre('save', function(next) {
    if (this.expiresAt && new Date() > this.expiresAt && this.status === 'pending') {
        this.status = 'expired';
    }
    next();
});

// Method to get remaining amount
paymentRequestSchema.methods.getRemainingAmount = function() {
    return this.amount - this.amountPaid;
};

// Method to get payment progress percentage
paymentRequestSchema.methods.getProgressPercentage = function() {
    if (this.amount === 0) return 0;
    return (this.amountPaid / this.amount) * 100;
};

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
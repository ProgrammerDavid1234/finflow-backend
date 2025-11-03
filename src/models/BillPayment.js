// src/models/BillPayment.js
const mongoose = require('mongoose');

const billPaymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['airtime', 'data', 'electricity', 'internet', 'cable', 'water', 'betting'],
        required: true
    },
    provider: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    phoneNumber: String,
    accountNumber: String,
    meterNumber: String,
    smartCardNumber: String,
    packageName: String,
    dataBundle: String,
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    transactionId: String,
    providerReference: String,
    metadata: mongoose.Schema.Types.Mixed,
    completedAt: Date,
    failedReason: String
}, {
    timestamps: true
});

// Index for faster queries
billPaymentSchema.index({ user: 1, createdAt: -1 });
billPaymentSchema.index({ status: 1 });
billPaymentSchema.index({ type: 1, user: 1 });

module.exports = mongoose.model('BillPayment', billPaymentSchema);
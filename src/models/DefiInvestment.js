
// models/DefiInvestment.js
const mongoose = require('mongoose');

const defiInvestmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    protocol: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Lending', 'Staking', 'Liquidity Pool', 'Yield Farming'],
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
        get: v => parseFloat(v),
        set: v => parseFloat(v) || 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH']
    },
    apy: {
        type: Number,
        required: true,
        min: 0,
        get: v => parseFloat(v),
        set: v => parseFloat(v) || 0
    },
    earnings: {
        type: Number,
        default: 0,
        min: 0,
        get: v => parseFloat(v),
        set: v => parseFloat(v) || 0
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'withdrawn'],
        default: 'active'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    lastEarningsUpdate: {
        type: Date,
        default: Date.now
    },
    transactionHash: {
        type: String,
        default: ''
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Index for faster queries
defiInvestmentSchema.index({ userId: 1, status: 1 });
defiInvestmentSchema.index({ createdAt: -1 });

// Method to calculate current earnings based on APY
defiInvestmentSchema.methods.calculateEarnings = function() {
    const now = new Date();
    const daysInvested = Math.floor((now - this.startDate) / (1000 * 60 * 60 * 24));
    const yearlyEarnings = this.amount * (this.apy / 100);
    const dailyEarnings = yearlyEarnings / 365;
    this.earnings = parseFloat((dailyEarnings * daysInvested).toFixed(2));
    this.lastEarningsUpdate = now;
    return this.earnings;
};

// Method to withdraw investment
defiInvestmentSchema.methods.withdraw = function() {
    this.status = 'withdrawn';
    return this.amount + this.earnings;
};

module.exports = mongoose.model('DefiInvestment', defiInvestmentSchema);


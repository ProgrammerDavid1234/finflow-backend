const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        sparse: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        default: null,
    },
    fullName: {
        type: String,
        default: '',
        trim: true,
    },
    phoneNumber: {
        type: String,
        default: '',
        trim: true,
    },
    profileImage: {
        type: String,
        default: '',
    },
    // Balance is always stored in USD for consistency
    balanceUSD: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Display currency (what user wants to see)
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH'],
    },
    // Original currency of the account (for reference)
    baseCurrency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH'],
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    // Web3 Authentication Fields
    walletAddress: {
        type: String,
        sparse: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    walletType: {
        type: String,
        enum: ['metamask', 'walletconnect', 'none'],
        default: 'none',
    },
    authMethod: {
        type: String,
        enum: ['email', 'wallet', 'hybrid'],
        default: 'email',
        required: true,
    },
    nonce: {
        type: String,
        default: () => Math.floor(Math.random() * 1000000).toString(),
    },
    hasPassword: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    lastLogin: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Indexes for faster queries
userSchema.index({ email: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ authMethod: 1 });

// Virtual field for balance in user's preferred currency
userSchema.virtual('balance').get(function() {
    // This will be calculated dynamically by the controller
    return this.balanceUSD;
});

// Validation: Either email or walletAddress must be present
userSchema.pre('save', function(next) {
    if (!this.email && !this.walletAddress) {
        next(new Error('Either email or wallet address is required'));
    } else {
        next();
    }
});

// Method to get balance in specific currency
userSchema.methods.getBalanceInCurrency = async function(targetCurrency) {
    const { convertCurrency } = require('../services/currencyService');
    return await convertCurrency(this.balanceUSD, 'USD', targetCurrency);
};

module.exports = mongoose.model('User', userSchema);
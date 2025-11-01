// models/User.js - Updated with Crypto Assets
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
        get: v => parseFloat(v),
        set: v => parseFloat(v) || 0
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

    // ========== NEW: CRYPTO ASSETS ==========
    cryptoAssets: {
        type: Map,
        of: Number,
        default: new Map()
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
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Indexes for faster queries
userSchema.index({ email: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ authMethod: 1 });

// Virtual field for balance in user's preferred currency
userSchema.virtual('balance').get(function () {
    return parseFloat(this.balanceUSD);
});

// Validation: Either email or walletAddress must be present
userSchema.pre('save', function (next) {
    if (!this.email && !this.walletAddress) {
        next(new Error('Either email or wallet address is required'));
    } else {
        // Ensure balanceUSD is always a number
        if (this.balanceUSD !== undefined) {
            this.balanceUSD = parseFloat(this.balanceUSD) || 0;
        }
        next();
    }
});

// Method to get balance in specific currency
userSchema.methods.getBalanceInCurrency = async function (targetCurrency) {
    const { convertCurrency } = require('../service/currencyService');
    return await convertCurrency(this.balanceUSD, 'USD', targetCurrency);
};

// Method to add to balance (ensures numeric operation)
userSchema.methods.addToBalance = async function (amount, currency = 'USD') {
    const { convertCurrency } = require('../service/currencyService');
    const amountInUSD = await convertCurrency(parseFloat(amount), currency, 'USD');
    this.balanceUSD = parseFloat(this.balanceUSD) + parseFloat(amountInUSD);
    return this.balanceUSD;
};

// Method to subtract from balance (ensures numeric operation)
userSchema.methods.subtractFromBalance = async function (amount, currency = 'USD') {
    const { convertCurrency } = require('../service/currencyService');
    const amountInUSD = await convertCurrency(parseFloat(amount), currency, 'USD');
    const newBalance = parseFloat(this.balanceUSD) - parseFloat(amountInUSD);

    if (newBalance < 0) {
        throw new Error('Insufficient balance');
    }

    this.balanceUSD = newBalance;
    return this.balanceUSD;
};

// ========== NEW: CRYPTO ASSET METHODS ==========

// Get crypto asset balance
userSchema.methods.getCryptoBalance = function (symbol) {
    if (!this.cryptoAssets) {
        this.cryptoAssets = new Map();
    }
    return parseFloat(this.cryptoAssets.get(symbol) || 0);
};

// Add to crypto asset
userSchema.methods.addCryptoAsset = function (symbol, amount) {
    if (!this.cryptoAssets) {
        this.cryptoAssets = new Map();
    }
    const currentBalance = this.getCryptoBalance(symbol);
    const newBalance = parseFloat(currentBalance) + parseFloat(amount);
    this.cryptoAssets.set(symbol, newBalance);
    return newBalance;
};

// Subtract from crypto asset
userSchema.methods.subtractCryptoAsset = function (symbol, amount) {
    if (!this.cryptoAssets) {
        this.cryptoAssets = new Map();
    }
    const currentBalance = this.getCryptoBalance(symbol);
    const newBalance = parseFloat(currentBalance) - parseFloat(amount);

    if (newBalance < 0) {
        throw new Error(`Insufficient ${symbol} balance`);
    }

    this.cryptoAssets.set(symbol, newBalance);
    return newBalance;
};

// Get all crypto assets as object
userSchema.methods.getAllCryptoAssets = function () {
    if (!this.cryptoAssets) {
        return {};
    }
    const assets = {};
    this.cryptoAssets.forEach((value, key) => {
        if (value > 0) {
            assets[key] = parseFloat(value);
        }
    });
    return assets;
};

// Get total portfolio value in USD
userSchema.methods.getTotalPortfolioUSD = async function () {
    const { convertCurrencyToCrypto } = require('../service/exchangeService');

    let totalUSD = parseFloat(this.balanceUSD);

    if (this.cryptoAssets && this.cryptoAssets.size > 0) {
        for (const [symbol, amount] of this.cryptoAssets) {
            if (amount > 0) {
                try {
                    const valueInUSD = await convertCurrencyToCrypto(amount, symbol, 'USD');
                    totalUSD += parseFloat(valueInUSD);
                } catch (error) {
                    console.error(`Error converting ${symbol}:`, error);
                }
            }
        }
    }

    return parseFloat(totalUSD.toFixed(2));
};

module.exports = mongoose.model('User', userSchema);
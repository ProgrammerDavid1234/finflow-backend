const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        sparse: true, // Allow multiple null values
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        // Password is optional for Web3 wallet users
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
    balance: {
        type: Number,
        default: 0,
        min: 0,
    },
    currency: {
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
        sparse: true, // Allow multiple null values
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

// Validation: Either email or walletAddress must be present
userSchema.pre('save', function(next) {
    if (!this.email && !this.walletAddress) {
        next(new Error('Either email or wallet address is required'));
    } else {
        next();
    }
});

module.exports = mongoose.model('User', userSchema);
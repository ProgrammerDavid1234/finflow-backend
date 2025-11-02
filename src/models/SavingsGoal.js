const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    targetAmount: {
        type: Number,
        required: true,
        min: 0,
        get: v => parseFloat(v),
        set: v => parseFloat(v) || 0
    },
    currentAmount: {
        type: Number,
        default: 0,
        min: 0,
        get: v => parseFloat(v),
        set: v => parseFloat(v) || 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH']
    },
    targetDate: {
        type: Date,
        default: null
    },
    nftReward: {
        type: Boolean,
        default: false
    },
    nftMinted: {
        type: Boolean,
        default: false
    },
    nftTokenId: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    category: {
        type: String,
        enum: ['Emergency Fund', 'Vacation', 'Shopping', 'Education', 'Health', 'Investment', 'Other'],
        default: 'Other'
    },
    icon: {
        type: String,
        default: '🎯'
    }
}, {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
});

// Indexes for faster queries
savingsGoalSchema.index({ userId: 1, status: 1 });
savingsGoalSchema.index({ createdAt: -1 });

// Virtual field for progress percentage
savingsGoalSchema.virtual('progress').get(function() {
    if (this.targetAmount === 0) return 0;
    const percentage = (this.currentAmount / this.targetAmount) * 100;
    return parseFloat(Math.min(percentage, 100).toFixed(1));
});

// Virtual field for remaining amount
savingsGoalSchema.virtual('remaining').get(function() {
    const remaining = this.targetAmount - this.currentAmount;
    return parseFloat(Math.max(remaining, 0).toFixed(2));
});

// Method to add funds
savingsGoalSchema.methods.addFunds = function(amount) {
    this.currentAmount = parseFloat(this.currentAmount) + parseFloat(amount);
    
    // Check if goal is completed
    if (this.currentAmount >= this.targetAmount) {
        this.status = 'completed';
        this.currentAmount = this.targetAmount; // Cap at target
    }
    
    return this.currentAmount;
};

// Method to withdraw funds
savingsGoalSchema.methods.withdrawFunds = function(amount) {
    if (amount > this.currentAmount) {
        throw new Error('Insufficient funds in goal');
    }
    
    this.currentAmount = parseFloat(this.currentAmount) - parseFloat(amount);
    
    // Reopen goal if it was completed
    if (this.status === 'completed' && this.currentAmount < this.targetAmount) {
        this.status = 'active';
    }
    
    return this.currentAmount;
};

// Method to check if NFT reward should be minted
savingsGoalSchema.methods.shouldMintNFT = function() {
    return this.nftReward && 
           this.status === 'completed' && 
           !this.nftMinted && 
           this.currentAmount >= this.targetAmount;
};

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);

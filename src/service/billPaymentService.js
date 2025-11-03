// src/service/billPaymentService.js
const BillPayment = require('../models/BillPayment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

class BillPaymentService {
    // Service providers configuration
    static PROVIDERS = {
        airtime: ['MTN', 'Airtel', 'Glo', '9mobile', 'AT&T', 'Verizon', 'T-Mobile'],
        data: ['MTN', 'Airtel', 'Glo', '9mobile', 'AT&T', 'Verizon', 'T-Mobile'],
        electricity: ['EKEDC', 'IKEDC', 'AEDC', 'PHED', 'IBEDC', 'KEDCO'],
        internet: ['Spectranet', 'Smile', 'Swift', 'Comcast', 'AT&T Internet'],
        cable: ['DStv', 'GOtv', 'StarTimes', 'Netflix', 'Hulu', 'Amazon Prime'],
        water: ['Lagos Water', 'Abuja Water', 'Rivers Water', 'City Water'],
        betting: ['Bet9ja', 'Sportybet', '1xBet', 'BetKing', 'NairaBet']
    };

    static DATA_BUNDLES = {
        MTN: [
            { name: '1GB Daily', amount: 1, validity: '1 day' },
            { name: '2GB Weekly', amount: 2, validity: '7 days' },
            { name: '10GB Monthly', amount: 5, validity: '30 days' },
            { name: '20GB Monthly', amount: 10, validity: '30 days' },
            { name: '50GB Monthly', amount: 20, validity: '30 days' },
        ],
        Airtel: [
            { name: '1.5GB Daily', amount: 1, validity: '1 day' },
            { name: '3GB Weekly', amount: 2, validity: '7 days' },
            { name: '6GB Monthly', amount: 5, validity: '30 days' },
            { name: '15GB Monthly', amount: 10, validity: '30 days' },
            { name: '40GB Monthly', amount: 20, validity: '30 days' },
        ]
    };

    static CABLE_PACKAGES = {
        DStv: [
            { name: 'DStv Padi', amount: 10, channels: 40 },
            { name: 'DStv Yanga', amount: 15, channels: 60 },
            { name: 'DStv Confam', amount: 25, channels: 90 },
            { name: 'DStv Compact', amount: 40, channels: 120 },
            { name: 'DStv Premium', amount: 80, channels: 180 },
        ],
        GOtv: [
            { name: 'GOtv Lite', amount: 5, channels: 25 },
            { name: 'GOtv Jinja', amount: 8, channels: 35 },
            { name: 'GOtv Max', amount: 15, channels: 65 },
        ]
    };

    // Get available providers by service type
    static getProviders(type) {
        return this.PROVIDERS[type] || [];
    }

    // Get data bundles for a provider
    static getDataBundles(provider) {
        return this.DATA_BUNDLES[provider] || [];
    }

    // Get cable packages for a provider
    static getCablePackages(provider) {
        return this.CABLE_PACKAGES[provider] || [];
    }

    // Validate account/meter number (simulation)
    static async validateAccount(type, provider, accountNumber) {
        // In production, this would call the provider's API
        // For now, we'll simulate validation
        
        if (!accountNumber || accountNumber.length < 8) {
            return {
                valid: false,
                message: 'Invalid account number'
            };
        }

        // Simulate account validation
        return {
            valid: true,
            accountName: `Test Customer ${accountNumber.slice(-4)}`,
            accountNumber: accountNumber,
            provider: provider
        };
    }

    // Process bill payment
    static async processBillPayment(userId, paymentData) {
        const { type, provider, amount, currency, ...otherData } = paymentData;

        // Validate provider
        if (!this.PROVIDERS[type]?.includes(provider)) {
            throw new Error(`Invalid provider for ${type}`);
        }

        // Validate amount
        if (amount <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        // Get user and check balance
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Convert amount to USD for balance check
        const { convertCurrency } = require('./currencyService');
        const amountInUSD = await convertCurrency(amount, currency || user.currency, 'USD');

        // Check balance (use balanceUSD which is the actual field in User model)
        if (user.balanceUSD < amountInUSD) {
            const availableInCurrency = await convertCurrency(user.balanceUSD, 'USD', currency || user.currency);
            throw new Error(`Insufficient balance. Available: ${availableInCurrency.toFixed(2)} ${currency || user.currency}`);
        }

        // Create bill payment record
        const billPayment = new BillPayment({
            user: userId,
            type,
            provider,
            amount,
            currency: currency || user.currency,
            ...otherData,
            status: 'processing'
        });

        await billPayment.save();

        try {
            // Deduct from user balance
            user.balance -= amount;
            await user.save();

            // Simulate provider API call
            const providerResponse = await this.callProviderAPI(type, provider, {
                amount,
                ...otherData
            });

            // Get exchange rates for USD conversion
            const exchangeService = require('./exchangeService');
            let amountUSD = amount;
            
            if (currency && currency !== 'USD') {
                try {
                    const rate = await exchangeService.getExchangeRate(currency, 'USD');
                    amountUSD = amount * rate;
                } catch (error) {
                    console.error('Exchange rate error:', error);
                    // Fallback: use convertCurrency from currencyService
                    const { convertCurrency } = require('./currencyService');
                    amountUSD = await convertCurrency(amount, currency, 'USD');
                }
            }

            // Create transaction record with proper fields matching Transaction model
            const transaction = new Transaction({
                userId: userId,
                type: 'bill', // Valid enum value from Transaction model
                amount: amount, // Positive amount
                amountUSD: amountUSD, // Required field in USD
                currency: currency || user.currency,
                description: `${type.charAt(0).toUpperCase() + type.slice(1)} - ${provider}`,
                status: 'completed',
                balanceAfter: user.balance,
                fee: 0,
                metadata: {
                    billPaymentId: billPayment._id.toString(),
                    provider: provider,
                    serviceType: type,
                    billType: type,
                    ...otherData
                }
            });

            await transaction.save();

            // Update bill payment status
            billPayment.status = 'completed';
            billPayment.transactionId = transaction._id;
            billPayment.providerReference = providerResponse.reference;
            billPayment.completedAt = new Date();
            await billPayment.save();

            return {
                success: true,
                billPayment,
                transaction,
                providerReference: providerResponse.reference
            };

        } catch (error) {
            // Revert balance if payment fails
            user.balance += amount;
            await user.save();

            billPayment.status = 'failed';
            billPayment.failedReason = error.message;
            await billPayment.save();

            throw error;
        }
    }

    // Simulate provider API call
    static async callProviderAPI(type, provider, data) {
        // In production, this would call the actual provider's API
        // For now, we'll simulate a successful response
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate a mock reference
        const reference = `${type.toUpperCase()}-${provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return {
            success: true,
            reference,
            message: 'Payment processed successfully',
            timestamp: new Date()
        };
    }

    // Get user's bill payment history
    static async getBillPaymentHistory(userId, filters = {}) {
        const query = { user: userId };

        if (filters.type) {
            query.type = filters.type;
        }

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                query.createdAt.$gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                query.createdAt.$lte = new Date(filters.endDate);
            }
        }

        const payments = await BillPayment.find(query)
            .sort({ createdAt: -1 })
            .limit(filters.limit || 50);

        return payments;
    }

    // Get bill payment statistics
    static async getPaymentStats(userId) {
        const stats = await BillPayment.aggregate([
            { $match: { user: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$type',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                    lastPayment: { $max: '$createdAt' }
                }
            }
        ]);

        return stats;
    }
}

module.exports = BillPaymentService;
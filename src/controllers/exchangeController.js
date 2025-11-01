// controllers/exchangeController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const {
    convertCurrencyToCrypto,
    getUnifiedExchangeRate,
    getAllSupportedCurrencies,
    calculateExchangeFee,
} = require('../service/exchangeService');

// Get all supported currencies for exchange
exports.getSupportedCurrencies = async (req, res) => {
    try {
        const currencies = await getAllSupportedCurrencies();
        
        res.json({
            success: true,
            currencies,
            lastUpdated: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Get supported currencies error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch supported currencies',
        });
    }
};

// Get exchange rate between two currencies
exports.getExchangeRate = async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                error: 'From and To currencies are required',
            });
        }

        const rate = await getUnifiedExchangeRate(from, to);
        const fee = calculateExchangeFee(1);

        res.json({
            success: true,
            from,
            to,
            rate,
            fee,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Get exchange rate error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get exchange rate',
        });
    }
};

// Execute exchange
exports.executeExchange = async (req, res) => {
    try {
        const { fromCurrency, toCurrency, amount } = req.body;
        const userId = req.userId;

        // Validation
        if (!fromCurrency || !toCurrency || !amount) {
            return res.status(400).json({
                success: false,
                error: 'fromCurrency, toCurrency, and amount are required',
            });
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount',
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        // Determine if currencies are fiat or crypto
        const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN'];
        const isFromFiat = FIAT_CURRENCIES.includes(fromCurrency);
        const isToFiat = FIAT_CURRENCIES.includes(toCurrency);

        // Check if user has sufficient balance
        if (isFromFiat) {
            // Check fiat balance
            const { convertCurrency } = require('../service/currencyService');
            const balanceInFromCurrency = await convertCurrency(user.balanceUSD, 'USD', fromCurrency);
            
            if (balanceInFromCurrency < numericAmount) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient ${fromCurrency} balance`,
                    required: numericAmount,
                    available: balanceInFromCurrency,
                });
            }
        } else {
            // Check crypto balance
            const cryptoBalance = user.getCryptoBalance(fromCurrency);
            
            if (cryptoBalance < numericAmount) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient ${fromCurrency} balance`,
                    required: numericAmount,
                    available: cryptoBalance,
                });
            }
        }

        // Calculate exchange
        const exchangeRate = await getUnifiedExchangeRate(fromCurrency, toCurrency);
        const fee = calculateExchangeFee(numericAmount);
        const amountAfterFee = numericAmount - fee;
        const receivedAmount = await convertCurrencyToCrypto(amountAfterFee, fromCurrency, toCurrency);

        // Deduct from source
        if (isFromFiat) {
            await user.subtractFromBalance(numericAmount, fromCurrency);
        } else {
            user.subtractCryptoAsset(fromCurrency, numericAmount);
        }

        // Add to destination
        if (isToFiat) {
            await user.addToBalance(receivedAmount, toCurrency);
        } else {
            user.addCryptoAsset(toCurrency, receivedAmount);
        }

        // Save user
        await user.save();

        // Create transaction record
        const { convertCurrency } = require('../service/currencyService');
        const feeInUSD = isFromFiat 
            ? await convertCurrency(fee, fromCurrency, 'USD')
            : await convertCurrencyToCrypto(fee, fromCurrency, 'USD');

        const transaction = new Transaction({
            userId: user._id,
            type: 'exchange',
            amount: numericAmount,
            currency: fromCurrency,
            amountUSD: isFromFiat 
                ? await convertCurrency(numericAmount, fromCurrency, 'USD')
                : await convertCurrencyToCrypto(numericAmount, fromCurrency, 'USD'),
            status: 'completed',
            description: `Exchange ${numericAmount} ${fromCurrency} to ${receivedAmount.toFixed(8)} ${toCurrency}`,
            fee: feeInUSD,
            exchangeRate,
            balanceAfter: user.balanceUSD,
            recipient: {
                name: `${fromCurrency} → ${toCurrency}`,
            },
        });

        await transaction.save();

        // Get updated balances
        const balanceInPreferredCurrency = await user.getBalanceInCurrency(user.currency);
        const cryptoAssets = user.getAllCryptoAssets();

        res.json({
            success: true,
            message: 'Exchange completed successfully',
            exchange: {
                from: {
                    currency: fromCurrency,
                    amount: numericAmount,
                },
                to: {
                    currency: toCurrency,
                    amount: receivedAmount,
                },
                rate: exchangeRate,
                fee: fee,
                timestamp: new Date().toISOString(),
            },
            newBalance: balanceInPreferredCurrency,
            newBalanceUSD: user.balanceUSD,
            cryptoAssets,
            transaction: {
                id: transaction._id,
                type: transaction.type,
                status: transaction.status,
                createdAt: transaction.createdAt,
            },
        });
    } catch (error) {
        console.error('Execute exchange error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute exchange',
        });
    }
};

// Get user's crypto portfolio
exports.getCryptoPortfolio = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        const cryptoAssets = user.getAllCryptoAssets();
        const totalPortfolioUSD = await user.getTotalPortfolioUSD();
        const fiatBalanceUSD = user.balanceUSD;

        // Calculate crypto balance in USD
        const { convertCurrencyToCrypto } = require('../service/exchangeService');
        const cryptoBalances = {};
        let totalCryptoUSD = 0;

        for (const [symbol, amount] of Object.entries(cryptoAssets)) {
            const valueInUSD = await convertCurrencyToCrypto(amount, symbol, 'USD');
            cryptoBalances[symbol] = {
                amount,
                valueUSD: valueInUSD,
            };
            totalCryptoUSD += valueInUSD;
        }

        res.json({
            success: true,
            portfolio: {
                fiatBalance: {
                    USD: fiatBalanceUSD,
                    preferred: await user.getBalanceInCurrency(user.currency),
                    currency: user.currency,
                },
                cryptoAssets: cryptoBalances,
                totalCryptoUSD,
                totalPortfolioUSD,
            },
        });
    } catch (error) {
        console.error('Get crypto portfolio error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch crypto portfolio',
        });
    }
};

// Get exchange history
exports.getExchangeHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const transactions = await Transaction.find({
            userId: req.userId,
            type: 'exchange',
        })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Transaction.countDocuments({
            userId: req.userId,
            type: 'exchange',
        });

        res.json({
            success: true,
            exchanges: transactions,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count,
        });
    } catch (error) {
        console.error('Get exchange history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch exchange history',
        });
    }
};
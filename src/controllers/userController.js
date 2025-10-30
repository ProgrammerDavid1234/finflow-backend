const User = require('../models/User');
const { convertCurrency, getExchangeRates } = require('../service/currencyService');

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password -nonce');

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Convert balance to user's preferred currency
        const balanceInPreferredCurrency = await user.getBalanceInCurrency(user.currency);

        const userProfile = {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            profileImage: user.profileImage,
            balance: balanceInPreferredCurrency, // Balance in user's preferred currency
            balanceUSD: user.balanceUSD, // Original balance in USD
            currency: user.currency,
            baseCurrency: user.baseCurrency,
            walletAddress: user.walletAddress,
            walletType: user.walletType,
            authMethod: user.authMethod,
            isVerified: user.isVerified,
            hasPassword: user.hasPassword,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            joined: new Date(user.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric' 
            })
        };

        res.json({ success: true, user: userProfile });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, phoneNumber, profileImage, currency } = req.body;

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Update basic fields
        if (fullName !== undefined) user.fullName = fullName.trim();
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber.trim();
        if (profileImage !== undefined) user.profileImage = profileImage;

        // Handle currency change
        if (currency !== undefined && currency !== user.currency) {
            // Validate currency
            const validCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH'];
            if (!validCurrencies.includes(currency)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid currency. Supported: USD, EUR, GBP, NGN, BTC, ETH' 
                });
            }

            // Update currency preference (balance stays in USD internally)
            user.currency = currency;
        }

        await user.save();

        // Get balance in new currency for response
        const balanceInPreferredCurrency = await user.getBalanceInCurrency(user.currency);

        const updatedUser = {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            profileImage: user.profileImage,
            balance: balanceInPreferredCurrency,
            balanceUSD: user.balanceUSD,
            currency: user.currency,
            baseCurrency: user.baseCurrency,
            walletAddress: user.walletAddress,
            walletType: user.walletType,
            authMethod: user.authMethod,
            isVerified: user.isVerified,
            hasPassword: user.hasPassword,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            joined: new Date(user.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric' 
            })
        };

        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
};

// Get user balance
exports.getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Get balance in user's preferred currency
        const balanceInPreferredCurrency = await user.getBalanceInCurrency(user.currency);

        res.json({
            success: true,
            balance: balanceInPreferredCurrency,
            balanceUSD: user.balanceUSD,
            currency: user.currency,
            baseCurrency: user.baseCurrency
        });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch balance' });
    }
};

// Get all supported currencies with current exchange rates
exports.getCurrencies = async (req, res) => {
    try {
        // Get current exchange rates
        const rates = await getExchangeRates();

        const currencies = [
            {
                code: 'USD',
                name: 'US Dollar',
                symbol: '$',
                flag: '🇺🇸',
                rate: 1, // Base currency
            },
            {
                code: 'EUR',
                name: 'Euro',
                symbol: '€',
                flag: '🇪🇺',
                rate: rates.EUR || 0.85,
            },
            {
                code: 'GBP',
                name: 'British Pound',
                symbol: '£',
                flag: '🇬🇧',
                rate: rates.GBP || 0.73,
            },
            {
                code: 'NGN',
                name: 'Nigerian Naira',
                symbol: '₦',
                flag: '🇳🇬',
                rate: rates.NGN || 1500,
            },
            {
                code: 'BTC',
                name: 'Bitcoin',
                symbol: '₿',
                flag: '₿',
                rate: rates.BTC || 0.000023,
            },
            {
                code: 'ETH',
                name: 'Ethereum',
                symbol: 'Ξ',
                flag: 'Ξ',
                rate: rates.ETH || 0.00031,
            },
        ];

        res.json({
            success: true,
            currencies: currencies,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get currencies error:', error);
        // Return fallback data even on error
        const fallbackCurrencies = [
            { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rate: 1 },
            { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', rate: 0.85 },
            { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', rate: 0.73 },
            { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬', rate: 1500 },
            { code: 'BTC', name: 'Bitcoin', symbol: '₿', flag: '₿', rate: 0.000023 },
            { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', flag: 'Ξ', rate: 0.00031 },
        ];
        
        res.json({
            success: true,
            currencies: fallbackCurrencies,
            lastUpdated: new Date().toISOString(),
            note: 'Using fallback rates'
        });
    }
};

// Convert amount between currencies
exports.convertAmount = async (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency } = req.query;

        if (!amount || !fromCurrency || !toCurrency) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: amount, fromCurrency, toCurrency'
            });
        }

        const numericAmount = parseFloat(amount);

        if (isNaN(numericAmount) || numericAmount < 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        const convertedAmount = await convertCurrency(numericAmount, fromCurrency, toCurrency);

        res.json({
            success: true,
            originalAmount: numericAmount,
            convertedAmount: convertedAmount,
            fromCurrency: fromCurrency,
            toCurrency: toCurrency,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Convert amount error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to convert amount' 
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (!user.password) {
            return res.status(400).json({
                success: false,
                error: 'No password set for this account'
            });
        }

        // Verify current password
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
};

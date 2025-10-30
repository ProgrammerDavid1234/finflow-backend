const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/validators');
const { convertCurrency, getExchangeRate, getSupportedCurrencies } = require('../service/currencyService');

// Get user profile with balance in preferred currency
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Convert balance from USD to user's preferred currency
        const balanceInPreferredCurrency = await convertCurrency(
            user.balanceUSD,
            'USD',
            user.currency
        );

        const userProfile = {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            profileImage: user.profileImage,
            balance: balanceInPreferredCurrency,
            balanceUSD: user.balanceUSD, // Keep USD balance for reference
            currency: user.currency,
            baseCurrency: user.baseCurrency,
            isVerified: user.isVerified,
            walletAddress: user.walletAddress,
            walletType: user.walletType,
            authMethod: user.authMethod,
            hasPassword: user.hasPassword,
            joined: user.createdAt.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short' 
            }),
        };

        res.json({
            success: true,
            user: userProfile,
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update user profile (including currency change with conversion)
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, phoneNumber, currency, profileImage } = req.body;

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update basic fields
        if (fullName !== undefined) user.fullName = fullName;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
        if (profileImage !== undefined) user.profileImage = profileImage;

        // Handle currency change with immediate conversion
        if (currency && currency !== user.currency) {
            const validCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'BTC', 'ETH'];
            
            if (!validCurrencies.includes(currency)) {
                return res.status(400).json({ error: 'Invalid currency' });
            }

            // Update the display currency preference
            user.currency = currency;
            
            console.log(`Currency changed from ${user.currency} to ${currency}`);
            console.log(`Balance in USD: ${user.balanceUSD}`);
        }

        await user.save();

        // Convert balance to new currency for response
        const balanceInPreferredCurrency = await convertCurrency(
            user.balanceUSD,
            'USD',
            user.currency
        );

        console.log(`Converted balance: ${balanceInPreferredCurrency} ${user.currency}`);

        const userProfile = {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            profileImage: user.profileImage,
            balance: balanceInPreferredCurrency,
            balanceUSD: user.balanceUSD,
            currency: user.currency,
            baseCurrency: user.baseCurrency,
            isVerified: user.isVerified,
            walletAddress: user.walletAddress,
            walletType: user.walletType,
            authMethod: user.authMethod,
            hasPassword: user.hasPassword,
            joined: user.createdAt.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short' 
            }),
        };

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userProfile,
            conversionInfo: currency ? {
                oldCurrency: req.body.oldCurrency || 'USD',
                newCurrency: currency,
                balanceUSD: user.balanceUSD,
                balanceInNewCurrency: balanceInPreferredCurrency
            } : null
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.userId);

        if (!user || !user.password) {
            return res.status(400).json({ error: 'Cannot change password' });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get balance in multiple currencies
exports.getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get balance in user's preferred currency
        const balanceInPreferredCurrency = await convertCurrency(
            user.balanceUSD,
            'USD',
            user.currency
        );

        // Get all currency conversions
        const currencies = await getSupportedCurrencies();
        const balances = {};
        
        for (const curr of currencies) {
            balances[curr.code] = await convertCurrency(
                user.balanceUSD,
                'USD',
                curr.code
            );
        }

        // Get exchange rate for reference
        const exchangeRate = await getExchangeRate('USD', user.currency);

        res.json({
            success: true,
            balance: balanceInPreferredCurrency,
            balanceUSD: user.balanceUSD,
            currency: user.currency,
            exchangeRate,
            balances, // All currency conversions
        });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get supported currencies with rates
exports.getCurrencies = async (req, res) => {
    try {
        const currencies = await getSupportedCurrencies();

        res.json({
            success: true,
            currencies,
        });
    } catch (error) {
        console.error('Get currencies error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Convert amount between currencies (utility endpoint)
exports.convertAmount = async (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency } = req.query;

        if (!amount || !fromCurrency || !toCurrency) {
            return res.status(400).json({ 
                error: 'Amount, fromCurrency, and toCurrency are required' 
            });
        }

        const convertedAmount = await convertCurrency(
            parseFloat(amount),
            fromCurrency,
            toCurrency
        );

        const rate = await getExchangeRate(fromCurrency, toCurrency);

        res.json({
            success: true,
            original: {
                amount: parseFloat(amount),
                currency: fromCurrency
            },
            converted: {
                amount: convertedAmount,
                currency: toCurrency
            },
            exchangeRate: rate,
        });
    } catch (error) {
        console.error('Convert amount error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
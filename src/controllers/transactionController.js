const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { convertCurrency, getExchangeRate } = require('../service/currencyService');

// Create transaction with currency conversion
exports.createTransaction = async (req, res) => {
    try {
        const { type, amount, currency, recipient, description } = req.body;

        if (!type || !amount) {
            return res.status(400).json({ error: 'Type and amount are required' });
        }

        // Parse amount to ensure it's a number
        const numericAmount = parseFloat(amount);
        
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a valid positive number' });
        }

        const user = await User.findById(req.userId);
        const transactionCurrency = currency || user.currency;

        // Convert transaction amount to USD for balance calculation
        const amountInUSD = await convertCurrency(numericAmount, transactionCurrency, 'USD');

        // Check balance for send/withdrawal transactions (compare in USD)
        if (['send', 'withdrawal', 'bill'].includes(type)) {
            if (user.balanceUSD < amountInUSD) {
                return res.status(400).json({ 
                    error: 'Insufficient balance',
                    required: numericAmount,
                    available: await convertCurrency(user.balanceUSD, 'USD', transactionCurrency),
                    currency: transactionCurrency
                });
            }
            // Subtract from balance (ensure numeric operation)
            user.balanceUSD = parseFloat(user.balanceUSD) - parseFloat(amountInUSD);
        } else if (['receive', 'topup'].includes(type)) {
            // Add to balance (ensure numeric operation)
            user.balanceUSD = parseFloat(user.balanceUSD) + parseFloat(amountInUSD);
        }

        // Get exchange rate for reference
        const exchangeRate = await getExchangeRate(transactionCurrency, 'USD');

        const transaction = new Transaction({
            userId: req.userId,
            type,
            amount: numericAmount,
            currency: transactionCurrency,
            recipient,
            description,
            balanceAfter: user.balanceUSD,
            exchangeRate,
            amountUSD: amountInUSD,
        });

        await transaction.save();
        await user.save();

        // Convert balance to user's preferred currency for response
        const balanceInPreferredCurrency = await convertCurrency(
            user.balanceUSD,
            'USD',
            user.currency
        );

        res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            transaction: {
                ...transaction.toObject(),
                balanceAfterInPreferredCurrency: balanceInPreferredCurrency
            },
            newBalance: balanceInPreferredCurrency,
            newBalanceUSD: user.balanceUSD,
            currency: user.currency,
        });
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all transactions with currency conversion
exports.getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status } = req.query;

        const user = await User.findById(req.userId);
        const filter = { userId: req.userId };
        if (type) filter.type = type;
        if (status) filter.status = status;

        const transactions = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Transaction.countDocuments(filter);

        // Convert transaction amounts to user's preferred currency if different
        const transactionsWithConversion = await Promise.all(
            transactions.map(async (tx) => {
                let convertedAmount = tx.amount;
                
                // If transaction currency differs from user's preferred currency, convert
                if (tx.currency !== user.currency) {
                    convertedAmount = await convertCurrency(
                        tx.amount,
                        tx.currency,
                        user.currency
                    );
                }

                return {
                    ...tx.toObject(),
                    originalAmount: tx.amount,
                    originalCurrency: tx.currency,
                    displayAmount: convertedAmount,
                    displayCurrency: user.currency,
                };
            })
        );

        res.json({
            success: true,
            transactions: transactionsWithConversion,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count,
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single transaction
exports.getTransaction = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Convert to user's preferred currency if different
        let displayAmount = transaction.amount;
        if (transaction.currency !== user.currency) {
            displayAmount = await convertCurrency(
                transaction.amount,
                transaction.currency,
                user.currency
            );
        }

        const transactionData = {
            ...transaction.toObject(),
            originalAmount: transaction.amount,
            originalCurrency: transaction.currency,
            displayAmount,
            displayCurrency: user.currency,
        };

        res.json({ success: true, transaction: transactionData });
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get transaction statistics with currency conversion
exports.getStatistics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const user = await User.findById(req.userId);
        
        const now = new Date();
        let startDate;
        let previousPeriodStart;

        switch (period) {
            case 'week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
                break;
            case 'year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                previousPeriodStart = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
        }

        const transactions = await Transaction.find({
            userId: req.userId,
            createdAt: { $gte: startDate },
        });

        const previousTransactions = await Transaction.find({
            userId: req.userId,
            createdAt: { $gte: previousPeriodStart, $lt: startDate },
        });

        // Calculate stats in USD first, then convert to user's preferred currency
        let totalIncomeUSD = 0;
        let totalExpenseUSD = 0;
        let previousExpenseUSD = 0;
        const byType = {};
        const dailyData = [];

        // Current period calculations
        for (const tx of transactions) {
            // Convert to USD for consistent calculation
            const amountInUSD = tx.amountUSD || await convertCurrency(tx.amount, tx.currency, 'USD');

            if (['receive', 'topup'].includes(tx.type)) {
                totalIncomeUSD += parseFloat(amountInUSD);
            } else if (['send', 'withdrawal', 'bill'].includes(tx.type)) {
                totalExpenseUSD += parseFloat(amountInUSD);
            }

            byType[tx.type] = (byType[tx.type] || 0) + 1;
        }

        // Previous period expense (for comparison)
        for (const tx of previousTransactions) {
            const amountInUSD = tx.amountUSD || await convertCurrency(tx.amount, tx.currency, 'USD');
            if (['send', 'withdrawal', 'bill'].includes(tx.type)) {
                previousExpenseUSD += parseFloat(amountInUSD);
            }
        }

        // Calculate percentage change
        let percentageChange = 0;
        if (previousExpenseUSD > 0) {
            percentageChange = ((totalExpenseUSD - previousExpenseUSD) / previousExpenseUSD) * 100;
        }

        // Group transactions by day for chart
        const transactionsByDay = {};
        transactions.forEach(tx => {
            const date = new Date(tx.createdAt).toISOString().split('T')[0];
            if (!transactionsByDay[date]) {
                transactionsByDay[date] = 0;
            }
            const amountInUSD = tx.amountUSD || tx.amount;
            if (['send', 'withdrawal', 'bill'].includes(tx.type)) {
                transactionsByDay[date] += parseFloat(amountInUSD);
            }
        });

        // Create daily data array
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const totalUSD = transactionsByDay[dateStr] || 0;
            
            dailyData.push({
                date: dateStr,
                total: await convertCurrency(totalUSD, 'USD', user.currency)
            });
        }

        // Convert totals to user's preferred currency
        const totalIncome = await convertCurrency(totalIncomeUSD, 'USD', user.currency);
        const totalExpense = await convertCurrency(totalExpenseUSD, 'USD', user.currency);

        const stats = {
            totalIncome,
            totalExpense,
            totalIncomeUSD,
            totalExpenseUSD,
            totalTransactions: transactions.length,
            percentageChange: parseFloat(percentageChange.toFixed(2)),
            byType,
            dailyData,
            currency: user.currency,
        };

        res.json({ 
            success: true, 
            data: stats,
            stats // Backward compatibility
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
// Delete transaction with balance reversal
exports.deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Only allow deletion of pending or failed transactions to maintain data integrity
        if (transaction.status === 'completed') {
            return res.status(400).json({ 
                error: 'Cannot delete completed transactions. Please contact support for reversals.' 
            });
        }

        const user = await User.findById(req.userId);

        // Reverse the balance change if transaction affected balance
        if (transaction.status === 'pending') {
            const amountInUSD = transaction.amountUSD;

            // Reverse the transaction impact on balance
            if (['send', 'withdrawal', 'bill'].includes(transaction.type)) {
                // Add back to balance (transaction was a deduction)
                user.balanceUSD = parseFloat(user.balanceUSD) + parseFloat(amountInUSD);
            } else if (['receive', 'topup'].includes(transaction.type)) {
                // Subtract from balance (transaction was an addition)
                user.balanceUSD = parseFloat(user.balanceUSD) - parseFloat(amountInUSD);
            }

            await user.save();
        }

        await Transaction.findByIdAndDelete(req.params.id);

        // Convert balance to user's preferred currency for response
        const balanceInPreferredCurrency = await convertCurrency(
            user.balanceUSD,
            'USD',
            user.currency
        );

        res.json({
            success: true,
            message: 'Transaction deleted successfully',
            newBalance: balanceInPreferredCurrency,
            newBalanceUSD: user.balanceUSD,
            currency: user.currency,
        });
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete multiple transactions (bulk delete)
exports.deleteTransactions = async (req, res) => {
    try {
        const { transactionIds } = req.body;

        if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
            return res.status(400).json({ error: 'Transaction IDs array is required' });
        }

        const transactions = await Transaction.find({
            _id: { $in: transactionIds },
            userId: req.userId,
        });

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'No transactions found' });
        }

        // Check if any completed transactions
        const completedTransactions = transactions.filter(tx => tx.status === 'completed');
        if (completedTransactions.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete completed transactions',
                completedCount: completedTransactions.length
            });
        }

        const user = await User.findById(req.userId);
        let balanceAdjustment = 0;

        // Calculate total balance adjustment
        transactions.forEach(tx => {
            if (tx.status === 'pending') {
                const amountInUSD = tx.amountUSD;

                if (['send', 'withdrawal', 'bill'].includes(tx.type)) {
                    balanceAdjustment += parseFloat(amountInUSD);
                } else if (['receive', 'topup'].includes(tx.type)) {
                    balanceAdjustment -= parseFloat(amountInUSD);
                }
            }
        });

        // Apply balance adjustment
        user.balanceUSD = parseFloat(user.balanceUSD) + balanceAdjustment;
        await user.save();

        // Delete all transactions
        const result = await Transaction.deleteMany({
            _id: { $in: transactionIds },
            userId: req.userId,
        });

        const balanceInPreferredCurrency = await convertCurrency(
            user.balanceUSD,
            'USD',
            user.currency
        );

        res.json({
            success: true,
            message: `${result.deletedCount} transaction(s) deleted successfully`,
            deletedCount: result.deletedCount,
            newBalance: balanceInPreferredCurrency,
            newBalanceUSD: user.balanceUSD,
            currency: user.currency,
        });
    } catch (error) {
        console.error('Bulk delete transactions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
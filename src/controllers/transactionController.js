const Transaction = require('../models/Transaction');
const User = require('../models/User');

// Create transaction
exports.createTransaction = async (req, res) => {
    try {
        const { type, amount, currency, recipient, description } = req.body;

        if (!type || !amount) {
            return res.status(400).json({ error: 'Type and amount are required' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        const user = await User.findById(req.userId);

        // Check balance for send/withdrawal transactions
        if (['send', 'withdrawal', 'bill'].includes(type)) {
            if (user.balance < amount) {
                return res.status(400).json({ error: 'Insufficient balance' });
            }
            user.balance -= amount;
        } else if (['receive', 'topup'].includes(type)) {
            user.balance += amount;
        }

        const transaction = new Transaction({
            userId: req.userId,
            type,
            amount,
            currency: currency || user.currency,
            recipient,
            description,
            balanceAfter: user.balance,
        });

        await transaction.save();
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            transaction,
            newBalance: user.balance,
        });
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all transactions
exports.getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status } = req.query;

        const filter = { userId: req.userId };
        if (type) filter.type = type;
        if (status) filter.status = status;

        const transactions = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Transaction.countDocuments(filter);

        res.json({
            success: true,
            transactions,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
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
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ success: true, transaction });
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get transaction statistics
exports.getStatistics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        const now = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                startDate = new Date(now.setMonth(now.getMonth() - 1));
        }

        const transactions = await Transaction.find({
            userId: req.userId,
            createdAt: { $gte: startDate },
        });

        const stats = {
            totalIncome: 0,
            totalExpense: 0,
            totalTransactions: transactions.length,
            byType: {},
        };

        transactions.forEach(transaction => {
            if (['receive', 'topup'].includes(transaction.type)) {
                stats.totalIncome += transaction.amount;
            } else if (['send', 'withdrawal', 'bill'].includes(transaction.type)) {
                stats.totalExpense += transaction.amount;
            }

            stats.byType[transaction.type] = (stats.byType[transaction.type] || 0) + 1;
        });

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
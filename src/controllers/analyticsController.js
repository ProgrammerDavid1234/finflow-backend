// controllers/analyticsController.js - Complete with CRUD operations
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const User = require('../models/User');
const DefiInvestment = require('../models/DefiInvestment');
const SavingsGoal = require('../models/SavingsGoal');
const { convertCurrency } = require('../service/currencyService');

// ========== SPENDING ANALYTICS ==========

exports.getSpendingByCategory = async (req, res) => {
    try {
        const { period = 'monthly', currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        const now = new Date();
        let startDate;

        switch (period) {
            case 'weekly':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        }

        const transactions = await Transaction.find({
            userId: req.userId,
            type: { $in: ['send', 'withdrawal', 'bill'] },
            status: 'completed',
            createdAt: { $gte: startDate }
        });

        const categoryMap = {};
        const categories = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Education', 'Other'];
        
        categories.forEach(cat => {
            categoryMap[cat] = { amount: 0, count: 0 };
        });

        for (const tx of transactions) {
            let category = 'Other';
            
            if (tx.description) {
                const desc = tx.description.toLowerCase();
                if (desc.includes('food') || desc.includes('restaurant') || desc.includes('dining')) category = 'Food';
                else if (desc.includes('transport') || desc.includes('uber') || desc.includes('taxi')) category = 'Transport';
                else if (desc.includes('entertainment') || desc.includes('movie') || desc.includes('game')) category = 'Entertainment';
                else if (desc.includes('shopping') || desc.includes('store') || desc.includes('mall')) category = 'Shopping';
                else if (desc.includes('bill') || desc.includes('utility') || desc.includes('electricity')) category = 'Bills';
                else if (desc.includes('health') || desc.includes('medical') || desc.includes('hospital')) category = 'Healthcare';
                else if (desc.includes('education') || desc.includes('school') || desc.includes('course')) category = 'Education';
            }

            const amountInTarget = await convertCurrency(tx.amountUSD, 'USD', targetCurrency);
            categoryMap[category].amount += parseFloat(amountInTarget);
            categoryMap[category].count += 1;
        }

        const spendingData = Object.keys(categoryMap)
            .filter(cat => categoryMap[cat].amount > 0)
            .map(cat => ({
                name: cat,
                amount: parseFloat(categoryMap[cat].amount.toFixed(2)),
                count: categoryMap[cat].count
            }));

        const total = spendingData.reduce((sum, item) => sum + item.amount, 0);

        res.json({
            success: true,
            period,
            currency: targetCurrency,
            totalSpent: parseFloat(total.toFixed(2)),
            categories: spendingData,
            transactionCount: transactions.length
        });
    } catch (error) {
        console.error('Get spending by category error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ========== PORTFOLIO PERFORMANCE ==========

exports.getPortfolioPerformance = async (req, res) => {
    try {
        const { period = 'weekly', currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        const now = new Date();
        let startDate, daysToShow;

        switch (period) {
            case 'weekly':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                daysToShow = 7;
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                daysToShow = 30;
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                daysToShow = 12;
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                daysToShow = 7;
        }

        const transactions = await Transaction.find({
            userId: req.userId,
            createdAt: { $gte: startDate },
            status: 'completed'
        }).sort({ createdAt: 1 });

        const dailyData = [];
        let runningBalanceUSD = 0;

        const previousTransactions = await Transaction.find({
            userId: req.userId,
            createdAt: { $lt: startDate },
            status: 'completed'
        });

        for (const tx of previousTransactions) {
            if (['receive', 'topup'].includes(tx.type)) {
                runningBalanceUSD += parseFloat(tx.amountUSD);
            } else if (['send', 'withdrawal', 'bill'].includes(tx.type)) {
                runningBalanceUSD -= parseFloat(tx.amountUSD);
            }
        }

        const transactionsByDay = {};
        transactions.forEach(tx => {
            const dateStr = new Date(tx.createdAt).toISOString().split('T')[0];
            if (!transactionsByDay[dateStr]) {
                transactionsByDay[dateStr] = [];
            }
            transactionsByDay[dateStr].push(tx);
        });

        for (let i = daysToShow - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            if (transactionsByDay[dateStr]) {
                for (const tx of transactionsByDay[dateStr]) {
                    if (['receive', 'topup'].includes(tx.type)) {
                        runningBalanceUSD += parseFloat(tx.amountUSD);
                    } else if (['send', 'withdrawal', 'bill'].includes(tx.type)) {
                        runningBalanceUSD -= parseFloat(tx.amountUSD);
                    }
                }
            }

            const balanceInTarget = await convertCurrency(runningBalanceUSD, 'USD', targetCurrency);
            
            dailyData.push({
                date: dateStr,
                label: period === 'yearly' 
                    ? date.toLocaleDateString('en-US', { month: 'short' }) 
                    : date.toLocaleDateString('en-US', { weekday: 'short' }),
                balance: parseFloat(balanceInTarget.toFixed(2))
            });
        }

        const firstBalance = dailyData[0]?.balance || 0;
        const lastBalance = dailyData[dailyData.length - 1]?.balance || 0;
        const change = lastBalance - firstBalance;
        const percentageChange = firstBalance > 0 ? ((change / firstBalance) * 100) : 0;

        res.json({
            success: true,
            period,
            currency: targetCurrency,
            currentBalance: parseFloat(lastBalance.toFixed(2)),
            startBalance: parseFloat(firstBalance.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            percentageChange: parseFloat(percentageChange.toFixed(2)),
            data: dailyData
        });
    } catch (error) {
        console.error('Get portfolio performance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ========== CRYPTO PORTFOLIO ==========

exports.getCryptoPortfolio = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const cryptoAssets = user.getAllCryptoAssets();

        const portfolio = [];
        let totalValueUSD = 0;

        const mockPrices = {
            'BTC': 50000,
            'ETH': 3000,
            'USDC': 1,
            'USDT': 1
        };

        const mockChanges = {
            'BTC': 5.2,
            'ETH': 3.8,
            'USDC': 0,
            'USDT': 0
        };

        for (const [symbol, amount] of Object.entries(cryptoAssets)) {
            const price = mockPrices[symbol] || 1;
            const value = amount * price;
            totalValueUSD += value;

            portfolio.push({
                symbol,
                name: symbol === 'BTC' ? 'Bitcoin' : symbol === 'ETH' ? 'Ethereum' : symbol,
                amount: parseFloat(amount.toFixed(8)),
                price: price,
                value: parseFloat(value.toFixed(2)),
                change24h: mockChanges[symbol] || 0
            });
        }

        res.json({
            success: true,
            totalValueUSD: parseFloat(totalValueUSD.toFixed(2)),
            assets: portfolio,
            assetCount: portfolio.length
        });
    } catch (error) {
        console.error('Get crypto portfolio error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ========== BLOCKCHAIN INSIGHTS ==========

exports.getBlockchainInsights = async (req, res) => {
    try {
        const insights = {
            gasFeesSaved: {
                value: 45.20,
                currency: 'USD',
                description: 'Total gas fees saved using optimized routes'
            },
            carbonOffset: {
                value: 12.5,
                unit: 'kg',
                description: 'Carbon emissions offset through green transactions'
            },
            rewardsEarned: {
                value: 250,
                unit: 'points',
                description: 'Total reward points earned'
            }
        };

        res.json({
            success: true,
            insights
        });
    } catch (error) {
        console.error('Get blockchain insights error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ========== DEFI INVESTMENTS - CRUD ==========

// Get all DeFi investments
exports.getDefiInvestments = async (req, res) => {
    try {
        const { status } = req.query;
        const query = { userId: req.userId };
        
        if (status) {
            query.status = status;
        }

        const investments = await DefiInvestment.find(query).sort({ createdAt: -1 });

        // Update earnings for all active investments
        for (const inv of investments) {
            if (inv.status === 'active') {
                inv.calculateEarnings();
                await inv.save();
            }
        }

        const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
        const totalEarnings = investments.reduce((sum, inv) => sum + inv.earnings, 0);
        const activeCount = investments.filter(inv => inv.status === 'active').length;

        res.json({
            success: true,
            investments,
            summary: {
                totalInvested: parseFloat(totalInvested.toFixed(2)),
                totalEarnings: parseFloat(totalEarnings.toFixed(2)),
                averageAPY: activeCount > 0 
                    ? parseFloat((investments.reduce((sum, inv) => sum + inv.apy, 0) / activeCount).toFixed(2))
                    : 0,
                activeInvestments: activeCount,
                totalInvestments: investments.length
            }
        });
    } catch (error) {
        console.error('Get DeFi investments error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create new DeFi investment
exports.createDefiInvestment = async (req, res) => {
    try {
        const { protocol, type, amount, apy, notes } = req.body;

        // Validate required fields
        if (!protocol || !type || !amount || !apy) {
            return res.status(400).json({ 
                error: 'Missing required fields: protocol, type, amount, apy' 
            });
        }

        // Validate investment type
        const validTypes = ['Lending', 'Staking', 'Liquidity Pool', 'Yield Farming'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ 
                error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
            });
        }

        // Validate amount
        if (parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }

        const user = await User.findById(req.userId);

        // Check if user has sufficient balance
        if (parseFloat(amount) > user.balanceUSD) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Create investment
        const investment = new DefiInvestment({
            userId: req.userId,
            protocol: protocol.trim(),
            type,
            amount: parseFloat(amount),
            currency: user.currency,
            apy: parseFloat(apy),
            notes: notes || ''
        });

        await investment.save();

        // Deduct from user balance
        await user.subtractFromBalance(amount, user.currency);
        await user.save();

        // Create transaction record
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: req.userId,
            type: 'withdrawal',
            amountUSD: parseFloat(amount),
            currency: user.currency,
            status: 'completed',
            description: `DeFi Investment: ${protocol} - ${type}`,
            recipientId: null
        });

        res.status(201).json({
            success: true,
            message: 'DeFi investment created successfully',
            investment,
            newBalance: user.balanceUSD
        });
    } catch (error) {
        console.error('Create DeFi investment error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

// Get single DeFi investment
exports.getDefiInvestment = async (req, res) => {
    try {
        const { id } = req.params;

        const investment = await DefiInvestment.findOne({
            _id: id,
            userId: req.userId
        });

        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        // Update earnings
        if (investment.status === 'active') {
            investment.calculateEarnings();
            await investment.save();
        }

        res.json({
            success: true,
            investment
        });
    } catch (error) {
        console.error('Get DeFi investment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update DeFi investment
exports.updateDefiInvestment = async (req, res) => {
    try {
        const { id } = req.params;
        const { protocol, type, amount, apy, status, notes } = req.body;

        const investment = await DefiInvestment.findOne({
            _id: id,
            userId: req.userId
        });

        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        // Update fields
        if (protocol) investment.protocol = protocol.trim();
        if (type) investment.type = type;
        if (amount) investment.amount = parseFloat(amount);
        if (apy) investment.apy = parseFloat(apy);
        if (status) investment.status = status;
        if (notes !== undefined) investment.notes = notes;

        await investment.save();

        res.json({
            success: true,
            message: 'Investment updated successfully',
            investment
        });
    } catch (error) {
        console.error('Update DeFi investment error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

// Withdraw from DeFi investment
exports.withdrawDefiInvestment = async (req, res) => {
    try {
        const { id } = req.params;

        const investment = await DefiInvestment.findOne({
            _id: id,
            userId: req.userId
        });

        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        if (investment.status === 'withdrawn') {
            return res.status(400).json({ error: 'Investment already withdrawn' });
        }

        // Calculate final earnings
        investment.calculateEarnings();
        const totalAmount = investment.withdraw();

        const user = await User.findById(req.userId);
        await user.addToBalance(totalAmount, investment.currency);
        await user.save();

        await investment.save();

        // Create transaction record
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: req.userId,
            type: 'receive',
            amountUSD: totalAmount,
            currency: investment.currency,
            status: 'completed',
            description: `DeFi Withdrawal: ${investment.protocol} (Principal: ${investment.amount}, Earnings: ${investment.earnings})`,
            senderId: null
        });

        res.json({
            success: true,
            message: 'Investment withdrawn successfully',
            investment,
            withdrawnAmount: parseFloat(totalAmount.toFixed(2)),
            principal: investment.amount,
            earnings: investment.earnings,
            newBalance: user.balanceUSD
        });
    } catch (error) {
        console.error('Withdraw DeFi investment error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

// Delete DeFi investment
exports.deleteDefiInvestment = async (req, res) => {
    try {
        const { id } = req.params;

        const investment = await DefiInvestment.findOneAndDelete({
            _id: id,
            userId: req.userId
        });

        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        res.json({
            success: true,
            message: 'Investment deleted successfully'
        });
    } catch (error) {
        console.error('Delete DeFi investment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ========== SAVINGS GOALS - CRUD ==========

// Get all savings goals
exports.getSavingsGoals = async (req, res) => {
    try {
        const { status, currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        const query = { userId: req.userId };
        if (status) {
            query.status = status;
        }

        const goals = await SavingsGoal.find(query).sort({ createdAt: -1 });

        // Convert to target currency if needed
        const goalsWithConversion = await Promise.all(
            goals.map(async (goal) => {
                const currentConverted = await convertCurrency(goal.currentAmount, goal.currency, targetCurrency);
                const targetConverted = await convertCurrency(goal.targetAmount, goal.currency, targetCurrency);

                return {
                    id: goal._id,
                    title: goal.title,
                    description: goal.description,
                    current: parseFloat(currentConverted.toFixed(2)),
                    goal: parseFloat(targetConverted.toFixed(2)),
                    currency: targetCurrency,
                    progress: goal.progress,
                    remaining: goal.remaining,
                    nftReward: goal.nftReward,
                    nftMinted: goal.nftMinted,
                    status: goal.status,
                    category: goal.category,
                    icon: goal.icon,
                    targetDate: goal.targetDate,
                    createdAt: goal.createdAt
                };
            })
        );

        const totalSaved = goalsWithConversion.reduce((sum, g) => sum + g.current, 0);
        const completedCount = goals.filter(g => g.status === 'completed').length;

        res.json({
            success: true,
            currency: targetCurrency,
            goals: goalsWithConversion,
            summary: {
                totalGoals: goals.length,
                activeGoals: goals.filter(g => g.status === 'active').length,
                completedGoals: completedCount,
                totalSaved: parseFloat(totalSaved.toFixed(2))
            }
        });
    } catch (error) {
        console.error('Get savings goals error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create new savings goal
exports.createSavingsGoal = async (req, res) => {
    try {
        const { title, description, targetAmount, targetDate, nftReward, category, icon } = req.body;

        if (!title || !targetAmount) {
            return res.status(400).json({ 
                error: 'Missing required fields: title, targetAmount' 
            });
        }

        if (parseFloat(targetAmount) <= 0) {
            return res.status(400).json({ error: 'Target amount must be greater than 0' });
        }

        const user = await User.findById(req.userId);

        const goal = new SavingsGoal({
            userId: req.userId,
            title: title.trim(),
            description: description || '',
            targetAmount: parseFloat(targetAmount),
            currency: user.currency,
            targetDate: targetDate || null,
            nftReward: nftReward || false,
            category: category || 'Other',
            icon: icon || '🎯'
        });

        await goal.save();

        res.status(201).json({
            success: true,
            message: 'Savings goal created successfully',
            goal
        });
    } catch (error) {
        console.error('Create savings goal error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

// Get single savings goal
exports.getSavingsGoal = async (req, res) => {
    try {
        const { id } = req.params;

        const goal = await SavingsGoal.findOne({
            _id: id,
            userId: req.userId
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        res.json({
            success: true,
            goal
        });
    } catch (error) {
        console.error('Get savings goal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update savings goal
exports.updateSavingsGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, targetAmount, targetDate, nftReward, status, category, icon } = req.body;

        const goal = await SavingsGoal.findOne({
            _id: id,
            userId: req.userId
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        if (title) goal.title = title.trim();
        if (description !== undefined) goal.description = description;
        if (targetAmount) goal.targetAmount = parseFloat(targetAmount);
        if (targetDate !== undefined) goal.targetDate = targetDate;
        if (nftReward !== undefined) goal.nftReward = nftReward;
        if (status) goal.status = status;
        if (category) goal.category = category;
        if (icon) goal.icon = icon;

        await goal.save();

        res.json({
            success: true,
            message: 'Goal updated successfully',
            goal
        });
    } catch (error) {
        console.error('Update savings goal error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

// Add funds to savings goal
exports.addFundsToGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const goal = await SavingsGoal.findOne({
            _id: id,
            userId: req.userId
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const user = await User.findById(req.userId);

        // Check balance
        if (parseFloat(amount) > user.balanceUSD) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct from user balance
        await user.subtractFromBalance(amount, goal.currency);
        await user.save();

        // Add to goal
        goal.addFunds(parseFloat(amount));
        await goal.save();

        // Create transaction
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: req.userId,
            type: 'withdrawal',
            amountUSD: parseFloat(amount),
            currency: goal.currency,
            status: 'completed',
            description: `Added to savings goal: ${goal.title}`,
            recipientId: null
        });

        // Check if NFT should be minted
        let nftMessage = null;
        if (goal.shouldMintNFT()) {
            nftMessage = 'Congratulations! You\'re eligible for an NFT reward!';
        }

        res.json({
            success: true,
            message: 'Funds added successfully',
            goal,
            newBalance: user.balanceUSD,
            nftEligible: goal.shouldMintNFT(),
            nftMessage
        });
    } catch (error) {
        console.error('Add funds to goal error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

// Withdraw from savings goal
exports.withdrawFromGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const goal = await SavingsGoal.findOne({
            _id: id,
            userId: req.userId
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const user = await User.findById(req.userId);

        // Withdraw from goal
        goal.withdrawFunds(parseFloat(amount));
        await goal.save();

        // Add to user balance
        await user.addToBalance(amount, goal.currency);
        await user.save();

        // Create transaction
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            userId: req.userId,
            type: 'receive',
            amountUSD: parseFloat(amount),
            currency: goal.currency,
            status: 'completed',
            description: `Withdrawn from savings goal: ${goal.title}`,
            senderId: null
        });

        res.json({
            success: true,
            message: 'Funds withdrawn successfully',
            goal,
            newBalance: user.balanceUSD
        });
    } catch (error) {
        console.error('Withdraw from goal error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

// Delete savings goal
exports.deleteSavingsGoal = async (req, res) => {
    try {
        const { id } = req.params;

        const goal = await SavingsGoal.findOne({
            _id: id,
            userId: req.userId
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        // Return funds to user if any
        if (goal.currentAmount > 0) {
            const user = await User.findById(req.userId);
            await user.addToBalance(goal.currentAmount, goal.currency);
            await user.save();

            // Create transaction
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                userId: req.userId,
                type: 'receive',
                amountUSD: goal.currentAmount,
                currency: goal.currency,
                status: 'completed',
                description: `Savings goal deleted, funds returned: ${goal.title}`,
                senderId: null
            });
        }

        await goal.deleteOne();

        res.json({
            success: true,
            message: 'Goal deleted successfully',
            fundsReturned: goal.currentAmount
        });
    } catch (error) {
        console.error('Delete savings goal error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get complete analytics dashboard
exports.getAnalyticsDashboard = async (req, res) => {
    try {
        const { period = 'monthly', currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        // This would call all the above functions
        res.json({
            success: true,
            message: 'Use individual endpoints for specific data',
            availableEndpoints: {
                spending: '/api/analytics/spending',
                performance: '/api/analytics/performance',
                crypto: '/api/analytics/crypto',
                goals: '/api/analytics/goals',
                insights: '/api/analytics/insights',
                defi: '/api/analytics/defi'
            }
        });
    } catch (error) {
        console.error('Get analytics dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = exports;
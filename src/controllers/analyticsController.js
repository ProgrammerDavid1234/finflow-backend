const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const User = require('../models/User');
const { convertCurrency } = require('../service/currencyService');

// Get spending by category (for pie chart)
exports.getSpendingByCategory = async (req, res) => {
    try {
        const { period = 'monthly', currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        // Calculate date range
        const now = new Date();
        let startDate;

        switch (period) {
            case 'weekly':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
            default: // monthly
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        }

        // Get all expense transactions
        const transactions = await Transaction.find({
            userId: req.userId,
            type: { $in: ['send', 'withdrawal', 'bill'] },
            status: 'completed',
            createdAt: { $gte: startDate }
        });

        // Get budgets to map transactions to categories
        const budgets = await Budget.find({ userId: req.userId });
        const categoryMap = {};

        // Initialize categories
        const categories = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Education', 'Other'];
        categories.forEach(cat => {
            categoryMap[cat] = { amount: 0, count: 0 };
        });

        // Aggregate spending by category
        for (const tx of transactions) {
            let category = 'Other';
            
            // Try to match with budget category or description
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

        // Format for pie chart
        const spendingData = Object.keys(categoryMap)
            .filter(cat => categoryMap[cat].amount > 0)
            .map(cat => ({
                name: cat,
                amount: parseFloat(categoryMap[cat].amount.toFixed(2)),
                count: categoryMap[cat].count,
                percentage: 0 // Will calculate below
            }));

        // Calculate percentages
        const total = spendingData.reduce((sum, item) => sum + item.amount, 0);
        spendingData.forEach(item => {
            item.percentage = parseFloat(((item.amount / total) * 100).toFixed(1));
        });

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

// Get portfolio performance (for line chart)
exports.getPortfolioPerformance = async (req, res) => {
    try {
        const { period = 'weekly', currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        const now = new Date();
        let startDate, days;

        switch (period) {
            case 'weekly':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                days = 7;
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                days = 30;
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                days = 365;
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                days = 7;
        }

        // Get all transactions in period
        const transactions = await Transaction.find({
            userId: req.userId,
            createdAt: { $gte: startDate },
            status: 'completed'
        }).sort({ createdAt: 1 });

        // Build daily balance data
        const dailyData = [];
        let runningBalanceUSD = 0;

        // Get starting balance (balance before the period)
        const previousTransactions = await Transaction.find({
            userId: req.userId,
            createdAt: { $lt: startDate },
            status: 'completed'
        });

        // Calculate starting balance
        for (const tx of previousTransactions) {
            if (['receive', 'topup'].includes(tx.type)) {
                runningBalanceUSD += parseFloat(tx.amountUSD);
            } else if (['send', 'withdrawal', 'bill'].includes(tx.type)) {
                runningBalanceUSD -= parseFloat(tx.amountUSD);
            }
        }

        // Group transactions by day
        const transactionsByDay = {};
        transactions.forEach(tx => {
            const dateStr = new Date(tx.createdAt).toISOString().split('T')[0];
            if (!transactionsByDay[dateStr]) {
                transactionsByDay[dateStr] = [];
            }
            transactionsByDay[dateStr].push(tx);
        });

        // Create daily data points
        const daysToShow = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 12;
        for (let i = daysToShow - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            // Process transactions for this day
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
                label: period === 'yearly' ? date.toLocaleDateString('en-US', { month: 'short' }) : date.toLocaleDateString('en-US', { weekday: 'short' }),
                balance: parseFloat(balanceInTarget.toFixed(2))
            });
        }

        // Calculate performance metrics
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

// Get crypto portfolio
exports.getCryptoPortfolio = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const cryptoAssets = user.getAllCryptoAssets();

        // Get current prices (you'll need a price service)
        const portfolio = [];
        let totalValueUSD = 0;

        for (const [symbol, amount] of Object.entries(cryptoAssets)) {
            // Mock price data - replace with real price API
            const mockPrices = {
                'BTC': 50000,
                'ETH': 3000,
                'USDC': 1,
                'USDT': 1
            };

            const price = mockPrices[symbol] || 1;
            const value = amount * price;
            totalValueUSD += value;

            // Mock 24h change - replace with real data
            const mockChanges = {
                'BTC': 5.2,
                'ETH': 3.8,
                'USDC': 0,
                'USDT': 0
            };

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

// Get savings goals
exports.getSavingsGoals = async (req, res) => {
    try {
        const { currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        // Mock savings goals - you can create a separate SavingsGoal model
        const mockGoals = [
            {
                id: '1',
                title: 'Summer Europe Trip',
                current: 1200,
                goal: 3000,
                currency: 'USD',
                nftReward: true,
                createdAt: new Date('2024-01-01')
            },
            {
                id: '2',
                title: 'Emergency Fund',
                current: 500,
                goal: 2000,
                currency: 'USD',
                nftReward: false,
                createdAt: new Date('2024-02-01')
            }
        ];

        // Convert to target currency
        const goalsWithConversion = await Promise.all(
            mockGoals.map(async (goal) => {
                const currentConverted = await convertCurrency(goal.current, goal.currency, targetCurrency);
                const goalConverted = await convertCurrency(goal.goal, goal.currency, targetCurrency);
                const progress = (goal.current / goal.goal) * 100;

                return {
                    ...goal,
                    current: parseFloat(currentConverted.toFixed(2)),
                    goal: parseFloat(goalConverted.toFixed(2)),
                    currency: targetCurrency,
                    progress: parseFloat(progress.toFixed(1)),
                    remaining: parseFloat((goalConverted - currentConverted).toFixed(2))
                };
            })
        );

        res.json({
            success: true,
            currency: targetCurrency,
            goals: goalsWithConversion,
            totalGoals: goalsWithConversion.length,
            totalSaved: goalsWithConversion.reduce((sum, g) => sum + g.current, 0)
        });
    } catch (error) {
        console.error('Get savings goals error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get blockchain insights
exports.getBlockchainInsights = async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        // Calculate insights
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
            },
            transactionSpeed: {
                value: '2.3',
                unit: 'seconds',
                description: 'Average transaction confirmation time'
            },
            securityScore: {
                value: 98,
                unit: '%',
                description: 'Account security rating'
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

// Get DeFi investments (mock data - implement based on your DeFi integration)
exports.getDefiInvestments = async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        const investments = [
            {
                protocol: 'Aave',
                type: 'Lending',
                apy: '4.2',
                amount: 2500,
                currency: 'USD',
                earnings: 105,
                status: 'active'
            },
            {
                protocol: 'Uniswap',
                type: 'Liquidity Pool',
                apy: '12.5',
                amount: 1800,
                currency: 'USD',
                earnings: 225,
                status: 'active'
            },
            {
                protocol: 'Compound',
                type: 'Staking',
                apy: '5.8',
                amount: 3200,
                currency: 'USD',
                earnings: 185.60,
                status: 'active'
            }
        ];

        const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
        const totalEarnings = investments.reduce((sum, inv) => sum + inv.earnings, 0);

        res.json({
            success: true,
            investments,
            summary: {
                totalInvested,
                totalEarnings,
                averageAPY: (investments.reduce((sum, inv) => sum + parseFloat(inv.apy), 0) / investments.length).toFixed(2),
                activeInvestments: investments.length
            }
        });
    } catch (error) {
        console.error('Get DeFi investments error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get complete analytics dashboard
exports.getAnalyticsDashboard = async (req, res) => {
    try {
        const { period = 'monthly', currency } = req.query;
        const user = await User.findById(req.userId);
        const targetCurrency = currency || user.currency;

        // Fetch all data in parallel
        const [
            spendingResult,
            performanceResult,
            cryptoResult,
            goalsResult,
            insightsResult
        ] = await Promise.all([
            getSpendingData(req.userId, period, targetCurrency),
            getPerformanceData(req.userId, period, targetCurrency),
            getCryptoData(req.userId),
            getGoalsData(req.userId, targetCurrency),
            getInsightsData(req.userId)
        ]);

        res.json({
            success: true,
            period,
            currency: targetCurrency,
            spending: spendingResult,
            performance: performanceResult,
            crypto: cryptoResult,
            goals: goalsResult,
            insights: insightsResult,
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('Get analytics dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Helper functions
async function getSpendingData(userId, period, currency) {
    // Reuse logic from getSpendingByCategory
    return { categories: [], totalSpent: 0 };
}

async function getPerformanceData(userId, period, currency) {
    // Reuse logic from getPortfolioPerformance
    return { data: [], currentBalance: 0 };
}

async function getCryptoData(userId) {
    // Reuse logic from getCryptoPortfolio
    return { assets: [], totalValueUSD: 0 };
}

async function getGoalsData(userId, currency) {
    // Reuse logic from getSavingsGoals
    return { goals: [], totalSaved: 0 };
}

async function getInsightsData(userId) {
    // Reuse logic from getBlockchainInsights
    return { gasFeesSaved: 0, carbonOffset: 0 };
}

module.exports = exports;
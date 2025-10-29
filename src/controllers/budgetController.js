const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

// Create budget
exports.createBudget = async (req, res) => {
    try {
        const { category, limit, period } = req.body;

        if (!category || !limit) {
            return res.status(400).json({ error: 'Category and limit are required' });
        }

        if (limit <= 0) {
            return res.status(400).json({ error: 'Limit must be positive' });
        }

        // Calculate end date based on period
        const startDate = new Date();
        let endDate = new Date();

        switch (period) {
            case 'daily':
                endDate.setDate(endDate.getDate() + 1);
                break;
            case 'weekly':
                endDate.setDate(endDate.getDate() + 7);
                break;
            case 'yearly':
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
            default: // monthly
                endDate.setMonth(endDate.getMonth() + 1);
        }

        const budget = new Budget({
            userId: req.userId,
            category,
            limit,
            period: period || 'monthly',
            startDate,
            endDate,
        });

        await budget.save();

        res.status(201).json({
            success: true,
            message: 'Budget created successfully',
            budget,
        });
    } catch (error) {
        console.error('Create budget error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all budgets
exports.getBudgets = async (req, res) => {
    try {
        const { isActive } = req.query;
        
        const filter = { userId: req.userId };
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const budgets = await Budget.find(filter).sort({ createdAt: -1 });

        res.json({ success: true, budgets });
    } catch (error) {
        console.error('Get budgets error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single budget
exports.getBudget = async (req, res) => {
    try {
        const budget = await Budget.findOne({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        res.json({ success: true, budget });
    } catch (error) {
        console.error('Get budget error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update budget
exports.updateBudget = async (req, res) => {
    try {
        const { category, limit, period, isActive } = req.body;

        const updateData = {};
        if (category) updateData.category = category;
        if (limit) {
            if (limit <= 0) {
                return res.status(400).json({ error: 'Limit must be positive' });
            }
            updateData.limit = limit;
        }
        if (period) updateData.period = period;
        if (isActive !== undefined) updateData.isActive = isActive;

        const budget = await Budget.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        res.json({
            success: true,
            message: 'Budget updated successfully',
            budget,
        });
    } catch (error) {
        console.error('Update budget error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete budget
exports.deleteBudget = async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        res.json({
            success: true,
            message: 'Budget deleted successfully',
        });
    } catch (error) {
        console.error('Delete budget error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get budget overview
exports.getBudgetOverview = async (req, res) => {
    try {
        const budgets = await Budget.find({
            userId: req.userId,
            isActive: true,
        });

        const overview = {
            totalBudgets: budgets.length,
            totalLimit: 0,
            totalSpent: 0,
            budgets: [],
        };

        for (const budget of budgets) {
            overview.totalLimit += budget.limit;
            overview.totalSpent += budget.spent;
            
            const percentage = (budget.spent / budget.limit) * 100;
            
            overview.budgets.push({
                id: budget._id,
                category: budget.category,
                limit: budget.limit,
                spent: budget.spent,
                remaining: budget.limit - budget.spent,
                percentage: percentage.toFixed(2),
                period: budget.period,
            });
        }

        res.json({ success: true, overview });
    } catch (error) {
        console.error('Get budget overview error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
// routes/analytics.js - Complete with CRUD routes
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ========== ANALYTICS ENDPOINTS ==========

// GET /api/analytics/spending - Get spending by category
router.get('/spending', analyticsController.getSpendingByCategory);

// GET /api/analytics/performance - Get portfolio performance
router.get('/performance', analyticsController.getPortfolioPerformance);

// GET /api/analytics/crypto - Get crypto portfolio
router.get('/crypto', analyticsController.getCryptoPortfolio);

// GET /api/analytics/insights - Get blockchain insights
router.get('/insights', analyticsController.getBlockchainInsights);

// GET /api/analytics/dashboard - Get complete dashboard
router.get('/dashboard', analyticsController.getAnalyticsDashboard);

// ========== DEFI INVESTMENT ENDPOINTS ==========

// GET /api/analytics/defi - Get all DeFi investments
router.get('/defi', analyticsController.getDefiInvestments);

// POST /api/analytics/defi - Create new DeFi investment
router.post('/defi', analyticsController.createDefiInvestment);

// GET /api/analytics/defi/:id - Get single DeFi investment
router.get('/defi/:id', analyticsController.getDefiInvestment);

// PUT /api/analytics/defi/:id - Update DeFi investment
router.put('/defi/:id', analyticsController.updateDefiInvestment);

// POST /api/analytics/defi/:id/withdraw - Withdraw from DeFi investment
router.post('/defi/:id/withdraw', analyticsController.withdrawDefiInvestment);

// DELETE /api/analytics/defi/:id - Delete DeFi investment
router.delete('/defi/:id', analyticsController.deleteDefiInvestment);

// ========== SAVINGS GOALS ENDPOINTS ==========

// GET /api/analytics/goals - Get all savings goals
router.get('/goals', analyticsController.getSavingsGoals);

// POST /api/analytics/goals - Create new savings goal
router.post('/goals', analyticsController.createSavingsGoal);

// GET /api/analytics/goals/:id - Get single savings goal
router.get('/goals/:id', analyticsController.getSavingsGoal);

// PUT /api/analytics/goals/:id - Update savings goal
router.put('/goals/:id', analyticsController.updateSavingsGoal);

// POST /api/analytics/goals/:id/add-funds - Add funds to savings goal
router.post('/goals/:id/add-funds', analyticsController.addFundsToGoal);

// POST /api/analytics/goals/:id/withdraw - Withdraw from savings goal
router.post('/goals/:id/withdraw', analyticsController.withdrawFromGoal);

// DELETE /api/analytics/goals/:id - Delete savings goal
router.delete('/goals/:id', analyticsController.deleteSavingsGoal);

module.exports = router;
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/analytics/spending - Get spending by category
router.get('/spending', analyticsController.getSpendingByCategory);

// GET /api/analytics/performance - Get portfolio performance
router.get('/performance', analyticsController.getPortfolioPerformance);

// GET /api/analytics/crypto - Get crypto portfolio
router.get('/crypto', analyticsController.getCryptoPortfolio);

// GET /api/analytics/goals - Get savings goals
router.get('/goals', analyticsController.getSavingsGoals);

// GET /api/analytics/insights - Get blockchain insights
router.get('/insights', analyticsController.getBlockchainInsights);

// GET /api/analytics/defi - Get DeFi investments
router.get('/defi', analyticsController.getDefiInvestments);

// GET /api/analytics/dashboard - Get complete dashboard
router.get('/dashboard', analyticsController.getAnalyticsDashboard);

module.exports = router;
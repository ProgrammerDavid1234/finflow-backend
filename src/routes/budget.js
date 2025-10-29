const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// POST /api/budgets - Create budget
router.post('/', budgetController.createBudget);

// GET /api/budgets - Get all budgets
router.get('/', budgetController.getBudgets);

// GET /api/budgets/overview - Get budget overview
router.get('/overview', budgetController.getBudgetOverview);

// GET /api/budgets/:id - Get single budget
router.get('/:id', budgetController.getBudget);

// PUT /api/budgets/:id - Update budget
router.put('/:id', budgetController.updateBudget);

// DELETE /api/budgets/:id - Delete budget
router.delete('/:id', budgetController.deleteBudget);

module.exports = router;
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authenticateToken = require('../middleware/auth');

// Log to verify routes are loaded
console.log('Transaction routes loaded');

// All routes require authentication
router.use(authenticateToken);

// POST /api/transactions - Create transaction
router.post('/', transactionController.createTransaction);

// GET /api/transactions - Get all transactions
router.get('/', transactionController.getTransactions);

// GET /api/transactions/statistics - Get transaction statistics
router.get('/statistics', transactionController.getStatistics);

// DELETE /api/transactions/bulk - Delete multiple transactions (before /:id route)
router.delete('/bulk', transactionController.deleteTransactions);

// GET /api/transactions/:id - Get single transaction
router.get('/:id', transactionController.getTransaction);

// DELETE /api/transactions/:id - Delete single transaction
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;
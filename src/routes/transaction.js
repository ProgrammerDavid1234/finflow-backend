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

// DELETE /api/transactions/bulk - Delete multiple transactions (with ?force=true option)
router.delete('/bulk', transactionController.deleteTransactions);

// DELETE /api/transactions/all - Delete ALL transactions and reset balance (requires confirmation)
router.delete('/all', transactionController.deleteAllTransactions);

// DELETE /api/transactions/pending - Delete only pending/failed transactions (safe)
router.delete('/pending', transactionController.deletePendingTransactions);

// GET /api/transactions/ids - Get transaction IDs grouped by status
router.get('/ids', transactionController.getTransactionIds);

// GET /api/transactions/:id - Get single transaction
router.get('/:id', transactionController.getTransaction);

// DELETE /api/transactions/:id - Delete single transaction (with ?force=true option)
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;
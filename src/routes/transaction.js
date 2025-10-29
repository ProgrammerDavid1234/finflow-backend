const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// POST /api/transactions - Create transaction
router.post('/', transactionController.createTransaction);

// GET /api/transactions - Get all transactions
router.get('/', transactionController.getTransactions);

// GET /api/transactions/statistics - Get transaction statistics
router.get('/statistics', transactionController.getStatistics);

// GET /api/transactions/:id - Get single transaction
router.get('/:id', transactionController.getTransaction);

module.exports = router;
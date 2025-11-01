// routes/exchange.js
const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/exchange/currencies - Get all supported currencies
router.get('/currencies', exchangeController.getSupportedCurrencies);

// GET /api/exchange/rate?from=USD&to=BTC - Get exchange rate
router.get('/rate', exchangeController.getExchangeRate);

// POST /api/exchange - Execute exchange
router.post('/', exchangeController.executeExchange);

// GET /api/exchange/portfolio - Get user's crypto portfolio
router.get('/portfolio', exchangeController.getCryptoPortfolio);

// GET /api/exchange/history - Get exchange history
router.get('/history', exchangeController.getExchangeHistory);

module.exports = router;
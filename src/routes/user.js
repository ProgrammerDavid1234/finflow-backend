const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// User Profile
// GET /api/user/profile
router.get('/profile', userController.getProfile);

// PUT /api/user/profile
router.put('/profile', userController.updateProfile);

// POST /api/user/change-password
router.post('/change-password', userController.changePassword);

// Balance
// GET /api/user/balance
router.get('/balance', userController.getBalance);

// Currency Management
// GET /api/user/currencies - Get all supported currencies with rates
router.get('/currencies', userController.getCurrencies);

// GET /api/user/convert - Convert amount between currencies
// Query params: amount, fromCurrency, toCurrency
router.get('/convert', userController.convertAmount);

module.exports = router;
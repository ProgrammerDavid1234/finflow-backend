// src/routes/transfer.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const transferController = require('../controllers/transferController');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/transfer
 * @desc    Create a new transfer
 * @access  Private
 * @body    { recipient, amount, currency, note, method }
 */
router.post('/', transferController.createTransfer);

/**
 * @route   POST /api/transfer/validate
 * @desc    Validate transfer before execution
 * @access  Private
 * @body    { recipient, amount, currency }
 */
router.post('/validate', transferController.validateTransfer);

/**
 * @route   GET /api/transfer/contacts
 * @desc    Get recent transfer contacts
 * @access  Private
 * @query   ?limit=10
 */
router.get('/contacts', transferController.getRecentContacts);

/**
 * @route   GET /api/transfer/history
 * @desc    Get transfer history
 * @access  Private
 * @query   ?page=1&limit=20&type=send|receive
 */
router.get('/history', transferController.getTransferHistory);

/**
 * @route   GET /api/transfer/search
 * @desc    Search for recipients
 * @access  Private
 * @query   ?q=search_query&limit=10
 */
router.get('/search', transferController.searchRecipients);

/**
 * @route   GET /api/transfer/recipient/:identifier
 * @desc    Get recipient details by email, phone, or wallet address
 * @access  Private
 */
router.get('/recipient/:identifier', transferController.getRecipientDetails);

/**
 * @route   GET /api/transfer/stats
 * @desc    Get transfer statistics
 * @access  Private
 * @query   ?period=week|month|year
 */
router.get('/stats', transferController.getTransferStats);

module.exports = router;
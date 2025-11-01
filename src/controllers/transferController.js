// src/controllers/transferController.js
const transferService = require('../service/transferService');
const { convertCurrency } = require('../service/currencyService');
const User = require('../models/User');

/**
 * Execute a transfer
 * POST /api/transfer
 */
exports.createTransfer = async (req, res) => {
    try {
        const { recipient, amount, currency, note, method } = req.body;

        // Validate required fields
        if (!recipient) {
            return res.status(400).json({
                success: false,
                error: 'Recipient is required'
            });
        }

        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid amount is required'
            });
        }

        const transferCurrency = currency || 'USD';
        const transferMethod = method || 'account';

        // Execute the transfer
        const result = await transferService.executeTransfer(
            req.userId,
            recipient,
            amount,
            transferCurrency,
            note,
            transferMethod
        );

        // Convert balance to sender's preferred currency
        const sender = await User.findById(req.userId);
        const balanceInPreferredCurrency = await convertCurrency(
            result.sender.newBalance,
            'USD',
            sender.currency
        );

        res.status(201).json({
            success: true,
            message: 'Transfer completed successfully',
            transaction: result.senderTransaction,
            newBalance: balanceInPreferredCurrency,
            newBalanceUSD: result.sender.newBalance,
            currency: sender.currency,
            recipient: result.recipient
        });
    } catch (error) {
        console.error('Create transfer error:', error);
        
        // Handle specific errors
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
        
        if (error.message.includes('Insufficient balance')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        if (error.message.includes('Cannot transfer to yourself')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Transfer failed',
            message: error.message
        });
    }
};

/**
 * Validate transfer before execution
 * POST /api/transfer/validate
 */
exports.validateTransfer = async (req, res) => {
    try {
        const { recipient, amount, currency } = req.body;

        if (!recipient || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Recipient and amount are required'
            });
        }

        const transferCurrency = currency || 'USD';

        const validation = await transferService.validateTransfer(
            req.userId,
            recipient,
            amount,
            transferCurrency
        );

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error,
                available: validation.available,
                required: validation.required,
                currency: validation.currency
            });
        }

        res.json({
            success: true,
            message: 'Transfer is valid',
            ...validation
        });
    } catch (error) {
        console.error('Validate transfer error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation failed',
            message: error.message
        });
    }
};

/**
 * Get recent contacts
 * GET /api/transfer/contacts
 */
exports.getRecentContacts = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const contacts = await transferService.getRecentContacts(
            req.userId,
            parseInt(limit)
        );

        res.json({
            success: true,
            contacts,
            count: contacts.length
        });
    } catch (error) {
        console.error('Get recent contacts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contacts',
            message: error.message
        });
    }
};

/**
 * Get transfer history
 * GET /api/transfer/history
 */
exports.getTransferHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20, type } = req.query;

        const result = await transferService.getTransferHistory(req.userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            type
        });

        // Convert amounts to user's preferred currency
        const user = await User.findById(req.userId);
        const transfersWithConversion = await Promise.all(
            result.transfers.map(async (transfer) => {
                let displayAmount = transfer.amount;
                
                if (transfer.currency !== user.currency) {
                    displayAmount = await convertCurrency(
                        transfer.amount,
                        transfer.currency,
                        user.currency
                    );
                }

                return {
                    ...transfer.toObject(),
                    originalAmount: transfer.amount,
                    originalCurrency: transfer.currency,
                    displayAmount,
                    displayCurrency: user.currency
                };
            })
        );

        res.json({
            success: true,
            transfers: transfersWithConversion,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get transfer history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transfer history',
            message: error.message
        });
    }
};

/**
 * Search for users/recipients
 * GET /api/transfer/search?q=query
 */
exports.searchRecipients = async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }

        const users = await transferService.searchUsers(
            q.trim(),
            req.userId,
            parseInt(limit)
        );

        res.json({
            success: true,
            users,
            count: users.length
        });
    } catch (error) {
        console.error('Search recipients error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed',
            message: error.message
        });
    }
};

/**
 * Find recipient details by identifier
 * GET /api/transfer/recipient/:identifier
 */
exports.getRecipientDetails = async (req, res) => {
    try {
        const { identifier } = req.params;

        if (!identifier) {
            return res.status(400).json({
                success: false,
                error: 'Identifier is required'
            });
        }

        const recipient = await transferService.findRecipient(identifier);

        if (!recipient) {
            return res.status(404).json({
                success: false,
                error: 'Recipient not found'
            });
        }

        // Don't allow finding yourself
        if (recipient._id.toString() === req.userId.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot transfer to yourself'
            });
        }

        res.json({
            success: true,
            recipient: {
                id: recipient._id,
                name: recipient.fullName || 'Unknown User',
                email: recipient.email,
                phone: recipient.phoneNumber,
                profileImage: recipient.profileImage,
                accountNumber: recipient.walletAddress || `****${recipient._id.toString().slice(-4)}`
            }
        });
    } catch (error) {
        console.error('Get recipient details error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recipient details',
            message: error.message
        });
    }
};

/**
 * Get transfer statistics
 * GET /api/transfer/stats
 */
exports.getTransferStats = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const user = await User.findById(req.userId);
        
        const now = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            case 'year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        }

        const Transaction = require('../models/Transaction');
        
        const sentTransfers = await Transaction.find({
            userId: req.userId,
            type: 'send',
            createdAt: { $gte: startDate }
        });

        const receivedTransfers = await Transaction.find({
            userId: req.userId,
            type: 'receive',
            createdAt: { $gte: startDate }
        });

        let totalSentUSD = 0;
        let totalReceivedUSD = 0;

        sentTransfers.forEach(tx => {
            totalSentUSD += parseFloat(tx.amountUSD || 0);
        });

        receivedTransfers.forEach(tx => {
            totalReceivedUSD += parseFloat(tx.amountUSD || 0);
        });

        // Convert to user's preferred currency
        const totalSent = await convertCurrency(totalSentUSD, 'USD', user.currency);
        const totalReceived = await convertCurrency(totalReceivedUSD, 'USD', user.currency);

        res.json({
            success: true,
            stats: {
                totalSent,
                totalReceived,
                totalSentUSD,
                totalReceivedUSD,
                sentCount: sentTransfers.length,
                receivedCount: receivedTransfers.length,
                currency: user.currency,
                period
            }
        });
    } catch (error) {
        console.error('Get transfer stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
};
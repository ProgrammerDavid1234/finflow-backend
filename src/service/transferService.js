// src/service/transferService.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { convertCurrency } = require('./currencyService');

class TransferService {
    /**
     * Find recipient by account number, phone, email, or wallet address
     */
    async findRecipient(identifier) {
        try {
            const mongoose = require('mongoose');
            
            // Build query conditions
            const conditions = [
                { email: identifier.toLowerCase() },
                { phoneNumber: identifier },
                { walletAddress: identifier.toLowerCase() }
            ];

            // Only add _id condition if identifier is a valid ObjectId
            if (mongoose.Types.ObjectId.isValid(identifier)) {
                conditions.push({ _id: identifier });
            }

            // Try to find by multiple fields
            const recipient = await User.findOne({
                $or: conditions
            }).select('-password -nonce');

            return recipient;
        } catch (error) {
            console.error('Find recipient error:', error);
            return null;
        }
    }

    /**
     * Validate recipient exists and is different from sender
     */
    async validateRecipient(senderId, recipientIdentifier) {
        const recipient = await this.findRecipient(recipientIdentifier);

        if (!recipient) {
            throw new Error('Recipient not found');
        }

        if (recipient._id.toString() === senderId.toString()) {
            throw new Error('Cannot transfer to yourself');
        }

        return recipient;
    }

    /**
     * Execute transfer between two users
     */
    async executeTransfer(senderId, recipientIdentifier, amount, currency, note = '', method = 'account') {
        try {
            // Validate amount
            const numericAmount = parseFloat(amount);
            if (isNaN(numericAmount) || numericAmount <= 0) {
                throw new Error('Invalid transfer amount');
            }

            // Find sender
            const sender = await User.findById(senderId);
            if (!sender) {
                throw new Error('Sender not found');
            }

            // Find and validate recipient
            const recipient = await this.validateRecipient(senderId, recipientIdentifier);

            // Convert amount to USD for balance operations
            const amountInUSD = await convertCurrency(numericAmount, currency, 'USD');

            // Check sender has sufficient balance
            if (sender.balanceUSD < amountInUSD) {
                const availableInCurrency = await convertCurrency(sender.balanceUSD, 'USD', currency);
                throw new Error(`Insufficient balance. Available: ${availableInCurrency.toFixed(2)} ${currency}`);
            }

            // Calculate fee (free for now, but structure is here for future)
            const fee = 0;
            const totalDeductionUSD = parseFloat(amountInUSD) + parseFloat(fee);

            // Deduct from sender
            sender.balanceUSD = parseFloat(sender.balanceUSD) - totalDeductionUSD;
            
            // Add to recipient
            recipient.balanceUSD = parseFloat(recipient.balanceUSD) + parseFloat(amountInUSD);

            // Save both users
            await sender.save();
            await recipient.save();

            // Create sender transaction (send)
            const senderTransaction = new Transaction({
                userId: sender._id,
                type: 'send',
                amount: numericAmount,
                amountUSD: amountInUSD,
                currency: currency,
                recipient: {
                    name: recipient.fullName || 'Unknown',
                    email: recipient.email,
                    phone: recipient.phoneNumber,
                    walletAddress: recipient.walletAddress
                },
                description: note || `Transfer to ${recipient.fullName || recipient.email || recipient.phoneNumber}`,
                status: 'completed',
                fee: fee,
                balanceAfter: sender.balanceUSD,
                metadata: {
                    transferMethod: method,
                    recipientId: recipient._id.toString()
                }
            });

            // Create recipient transaction (receive)
            const recipientTransaction = new Transaction({
                userId: recipient._id,
                type: 'receive',
                amount: numericAmount,
                amountUSD: amountInUSD,
                currency: currency,
                recipient: {
                    name: sender.fullName || 'Unknown',
                    email: sender.email,
                    phone: sender.phoneNumber,
                    walletAddress: sender.walletAddress
                },
                description: note || `Transfer from ${sender.fullName || sender.email || sender.phoneNumber}`,
                status: 'completed',
                fee: 0,
                balanceAfter: recipient.balanceUSD,
                metadata: {
                    transferMethod: method,
                    senderId: sender._id.toString()
                }
            });

            // Save both transactions
            await senderTransaction.save();
            await recipientTransaction.save();

            return {
                success: true,
                senderTransaction,
                recipientTransaction,
                sender: {
                    newBalance: sender.balanceUSD,
                    currency: sender.currency
                },
                recipient: {
                    id: recipient._id,
                    name: recipient.fullName,
                    email: recipient.email,
                    phone: recipient.phoneNumber
                }
            };
        } catch (error) {
            console.error('Execute transfer error:', error);
            throw error;
        }
    }

    /**
     * Get recent transfer contacts for a user
     */
    async getRecentContacts(userId, limit = 10) {
        try {
            // Find all send transactions
            const sentTransactions = await Transaction.find({
                userId: userId,
                type: 'send',
                status: 'completed'
            })
            .sort({ createdAt: -1 })
            .limit(50); // Get more to deduplicate

            // Extract unique recipient IDs
            const recipientIds = [...new Set(
                sentTransactions
                    .filter(tx => tx.metadata && tx.metadata.recipientId)
                    .map(tx => tx.metadata.recipientId)
            )];

            // Get recipient details
            const recipients = await User.find({
                _id: { $in: recipientIds }
            })
            .select('fullName email phoneNumber profileImage walletAddress')
            .limit(limit);

            // Map to contact format with last transaction date
            const contacts = recipients.map(recipient => {
                const lastTransaction = sentTransactions.find(
                    tx => tx.metadata && tx.metadata.recipientId === recipient._id.toString()
                );

                return {
                    id: recipient._id,
                    name: recipient.fullName || 'Unknown User',
                    email: recipient.email,
                    phone: recipient.phoneNumber,
                    profileImage: recipient.profileImage,
                    accountNumber: recipient.walletAddress || `****${recipient._id.toString().slice(-4)}`,
                    lastTransferDate: lastTransaction ? lastTransaction.createdAt : null,
                    lastTransferAmount: lastTransaction ? lastTransaction.amount : null,
                    lastTransferCurrency: lastTransaction ? lastTransaction.currency : null
                };
            });

            return contacts;
        } catch (error) {
            console.error('Get recent contacts error:', error);
            throw error;
        }
    }

    /**
     * Get transfer history for a user
     */
    async getTransferHistory(userId, { page = 1, limit = 20, type = null }) {
        try {
            const filter = {
                userId: userId,
                type: { $in: ['send', 'receive'] }
            };

            if (type && ['send', 'receive'].includes(type)) {
                filter.type = type;
            }

            const transfers = await Transaction.find(filter)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            const total = await Transaction.countDocuments(filter);

            return {
                transfers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get transfer history error:', error);
            throw error;
        }
    }

    /**
     * Validate transfer before execution
     */
    async validateTransfer(senderId, recipientIdentifier, amount, currency) {
        try {
            const numericAmount = parseFloat(amount);
            
            if (isNaN(numericAmount) || numericAmount <= 0) {
                return {
                    valid: false,
                    error: 'Invalid amount'
                };
            }

            // Minimum transfer amount (e.g., $0.01)
            if (numericAmount < 0.01) {
                return {
                    valid: false,
                    error: 'Minimum transfer amount is 0.01'
                };
            }

            const sender = await User.findById(senderId);
            if (!sender) {
                return {
                    valid: false,
                    error: 'Sender not found'
                };
            }

            const recipient = await this.findRecipient(recipientIdentifier);
            if (!recipient) {
                return {
                    valid: false,
                    error: 'Recipient not found'
                };
            }

            if (recipient._id.toString() === senderId.toString()) {
                return {
                    valid: false,
                    error: 'Cannot transfer to yourself'
                };
            }

            const amountInUSD = await convertCurrency(numericAmount, currency, 'USD');
            
            if (sender.balanceUSD < amountInUSD) {
                const availableInCurrency = await convertCurrency(sender.balanceUSD, 'USD', currency);
                return {
                    valid: false,
                    error: 'Insufficient balance',
                    available: availableInCurrency,
                    required: numericAmount,
                    currency: currency
                };
            }

            return {
                valid: true,
                recipient: {
                    id: recipient._id,
                    name: recipient.fullName,
                    email: recipient.email,
                    phone: recipient.phoneNumber,
                    profileImage: recipient.profileImage
                },
                sender: {
                    balance: sender.balanceUSD,
                    currency: sender.currency
                },
                transfer: {
                    amount: numericAmount,
                    amountUSD: amountInUSD,
                    currency: currency,
                    fee: 0
                }
            };
        } catch (error) {
            console.error('Validate transfer error:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Search for users (for finding recipients)
     */
    async searchUsers(query, currentUserId, limit = 10) {
        try {
            const searchRegex = new RegExp(query, 'i');
            
            const users = await User.find({
                _id: { $ne: currentUserId }, // Exclude current user
                $or: [
                    { email: searchRegex },
                    { fullName: searchRegex },
                    { phoneNumber: searchRegex }
                ]
            })
            .select('fullName email phoneNumber profileImage walletAddress')
            .limit(limit);

            return users.map(user => ({
                id: user._id,
                name: user.fullName || 'Unknown User',
                email: user.email,
                phone: user.phoneNumber,
                profileImage: user.profileImage,
                accountNumber: user.walletAddress || `****${user._id.toString().slice(-4)}`
            }));
        } catch (error) {
            console.error('Search users error:', error);
            throw error;
        }
    }
}

module.exports = new TransferService();
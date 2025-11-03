// src/controllers/billPaymentController.js
const BillPaymentService = require('../service/billPaymentService');

class BillPaymentController {
    // Get available providers for a service type
    static async getProviders(req, res) {
        try {
            const { type } = req.params;

            const providers = BillPaymentService.getProviders(type);

            if (!providers.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid service type'
                });
            }

            res.json({
                success: true,
                type,
                providers
            });
        } catch (error) {
            console.error('Get providers error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Get data bundles for a provider
    static async getDataBundles(req, res) {
        try {
            const { provider } = req.params;

            const bundles = BillPaymentService.getDataBundles(provider);

            res.json({
                success: true,
                provider,
                bundles
            });
        } catch (error) {
            console.error('Get data bundles error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Get cable packages for a provider
    static async getCablePackages(req, res) {
        try {
            const { provider } = req.params;

            const packages = BillPaymentService.getCablePackages(provider);

            res.json({
                success: true,
                provider,
                packages
            });
        } catch (error) {
            console.error('Get cable packages error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Validate account/meter number
    static async validateAccount(req, res) {
        try {
            const { type, provider, accountNumber } = req.body;

            if (!type || !provider || !accountNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const validation = await BillPaymentService.validateAccount(
                type,
                provider,
                accountNumber
            );

            res.json({
                success: true,
                ...validation
            });
        } catch (error) {
            console.error('Validate account error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Process airtime purchase
    static async purchaseAirtime(req, res) {
        try {
            const userId = req.user._id;
            const { provider, phoneNumber, amount, currency } = req.body;

            if (!provider || !phoneNumber || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const result = await BillPaymentService.processBillPayment(userId, {
                type: 'airtime',
                provider,
                phoneNumber,
                amount: parseFloat(amount),
                currency
            });

            res.json({
                success: true,
                message: 'Airtime purchase successful',
                ...result
            });
        } catch (error) {
            console.error('Purchase airtime error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Purchase mobile data
    static async purchaseData(req, res) {
        try {
            const userId = req.user._id;
            const { provider, phoneNumber, amount, dataBundle, currency } = req.body;

            if (!provider || !phoneNumber || !amount || !dataBundle) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const result = await BillPaymentService.processBillPayment(userId, {
                type: 'data',
                provider,
                phoneNumber,
                amount: parseFloat(amount),
                dataBundle,
                currency
            });

            res.json({
                success: true,
                message: 'Data purchase successful',
                ...result
            });
        } catch (error) {
            console.error('Purchase data error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Pay electricity bill
    static async payElectricity(req, res) {
        try {
            const userId = req.user._id;
            const { provider, meterNumber, amount, currency } = req.body;

            if (!provider || !meterNumber || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const result = await BillPaymentService.processBillPayment(userId, {
                type: 'electricity',
                provider,
                meterNumber,
                amount: parseFloat(amount),
                currency
            });

            res.json({
                success: true,
                message: 'Electricity bill paid successfully',
                ...result
            });
        } catch (error) {
            console.error('Pay electricity error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Pay internet bill
    static async payInternet(req, res) {
        try {
            const userId = req.user._id;
            const { provider, accountNumber, amount, currency } = req.body;

            if (!provider || !accountNumber || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const result = await BillPaymentService.processBillPayment(userId, {
                type: 'internet',
                provider,
                accountNumber,
                amount: parseFloat(amount),
                currency
            });

            res.json({
                success: true,
                message: 'Internet bill paid successfully',
                ...result
            });
        } catch (error) {
            console.error('Pay internet error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Pay cable TV bill
    static async payCable(req, res) {
        try {
            const userId = req.user._id;
            const { provider, smartCardNumber, packageName, amount, currency } = req.body;

            if (!provider || !smartCardNumber || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const result = await BillPaymentService.processBillPayment(userId, {
                type: 'cable',
                provider,
                smartCardNumber,
                packageName,
                amount: parseFloat(amount),
                currency
            });

            res.json({
                success: true,
                message: 'Cable TV bill paid successfully',
                ...result
            });
        } catch (error) {
            console.error('Pay cable error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Pay water bill
    static async payWater(req, res) {
        try {
            const userId = req.user._id;
            const { provider, accountNumber, amount, currency } = req.body;

            if (!provider || !accountNumber || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const result = await BillPaymentService.processBillPayment(userId, {
                type: 'water',
                provider,
                accountNumber,
                amount: parseFloat(amount),
                currency
            });

            res.json({
                success: true,
                message: 'Water bill paid successfully',
                ...result
            });
        } catch (error) {
            console.error('Pay water error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Fund betting account
    static async fundBetting(req, res) {
        try {
            const userId = req.user._id;
            const { provider, accountNumber, amount, currency } = req.body;

            if (!provider || !accountNumber || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const result = await BillPaymentService.processBillPayment(userId, {
                type: 'betting',
                provider,
                accountNumber,
                amount: parseFloat(amount),
                currency
            });

            res.json({
                success: true,
                message: 'Betting account funded successfully',
                ...result
            });
        } catch (error) {
            console.error('Fund betting error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Get payment history
    static async getPaymentHistory(req, res) {
        try {
            const userId = req.user._id;
            const { type, status, startDate, endDate, limit } = req.query;

            const history = await BillPaymentService.getBillPaymentHistory(userId, {
                type,
                status,
                startDate,
                endDate,
                limit: parseInt(limit) || 50
            });

            res.json({
                success: true,
                count: history.length,
                payments: history
            });
        } catch (error) {
            console.error('Get payment history error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Get payment statistics
    static async getPaymentStats(req, res) {
        try {
            const userId = req.user._id;

            const stats = await BillPaymentService.getPaymentStats(userId);

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Get payment stats error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = BillPaymentController;
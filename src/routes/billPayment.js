// src/routes/billPayment.js
const express = require('express');
const router = express.Router();
const BillPaymentController = require('../controllers/billPaymentController');

// Import auth middleware - adjust this line based on your actual auth.js file
// Common patterns:
// Option 1: const { protect } = require('../middleware/auth');
// Option 2: const auth = require('../middleware/auth');
// Option 3: const { authenticateToken } = require('../middleware/auth');

// Check your existing route files (like transaction.js, transfer.js) to see how they import auth
// For now, we'll try multiple patterns:

let authMiddleware;
try {
    const auth = require('../middleware/auth');
    // Try to find the correct auth function
    authMiddleware = auth.protect || auth.auth || auth.authenticateToken || auth.verifyToken || auth;
    
    if (typeof authMiddleware !== 'function') {
        throw new Error('Auth middleware is not a function');
    }
} catch (error) {
    console.error('⚠️  Auth middleware error:', error.message);
    console.log('📝 Please check your auth.js file and update billPayment.js routes accordingly');
    
    // Temporary fallback - will let requests through but log warning
    authMiddleware = (req, res, next) => {
        console.warn('⚠️  WARNING: Using temporary auth bypass. Please fix auth middleware import!');
        // You should set req.user here based on your auth structure
        next();
    };
}

// Apply authentication to all routes
router.use(authMiddleware);

// Get providers for a service type
router.get('/providers/:type', BillPaymentController.getProviders);

// Get data bundles for a provider
router.get('/data-bundles/:provider', BillPaymentController.getDataBundles);

// Get cable packages for a provider
router.get('/cable-packages/:provider', BillPaymentController.getCablePackages);

// Validate account/meter number
router.post('/validate-account', BillPaymentController.validateAccount);

// Service-specific payment routes
router.post('/airtime', BillPaymentController.purchaseAirtime);
router.post('/data', BillPaymentController.purchaseData);
router.post('/electricity', BillPaymentController.payElectricity);
router.post('/internet', BillPaymentController.payInternet);
router.post('/cable', BillPaymentController.payCable);
router.post('/water', BillPaymentController.payWater);
router.post('/betting', BillPaymentController.fundBetting);

// Payment history and statistics
router.get('/history', BillPaymentController.getPaymentHistory);
router.get('/stats', BillPaymentController.getPaymentStats);

module.exports = router;
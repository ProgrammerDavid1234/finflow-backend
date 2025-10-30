const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');

// Traditional Email/Password Authentication
// POST /api/auth/signup
router.post('/signup', authController.signup);

// POST /api/auth/login
router.post('/login', authController.login);

// Web3 Wallet Authentication
// POST /api/auth/wallet/nonce - Request nonce for wallet signature (can be used with or without auth)
router.post('/wallet/nonce', (req, res, next) => {
    // Try to authenticate, but don't require it
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        return authenticateToken(req, res, next);
    }
    next();
}, authController.requestNonce);

// POST /api/auth/wallet/verify - Verify wallet signature and login/connect (can be used with or without auth)
router.post('/wallet/verify', (req, res, next) => {
    // Try to authenticate, but don't require it
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        return authenticateToken(req, res, next);
    }
    next();
}, authController.verifyWallet);

// DELETE /api/auth/wallet/disconnect - Disconnect wallet from account (requires auth)
router.delete('/wallet/disconnect', authenticateToken, authController.disconnectWallet);

// POST /api/auth/wallet/set-password - Set password for wallet users (requires auth)
router.post('/wallet/set-password', authenticateToken, authController.setPasswordForWallet);

// GET /api/auth/verify - Verify if token is valid
router.get('/verify', authenticateToken, authController.verifyToken);

module.exports = router;
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/user/profile
router.get('/profile', userController.getProfile);

// PUT /api/user/profile
router.put('/profile', userController.updateProfile);

// POST /api/user/change-password
router.post('/change-password', userController.changePassword);

// GET /api/user/balance
router.get('/balance', userController.getBalance);

module.exports = router;
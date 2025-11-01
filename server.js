// server.js - Unified and Complete Server Setup

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./src/config/database'); // Centralized DB connection

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// ========== MIDDLEWARE SETUP ==========

// Webhook route requires raw body (important for Stripe, Paystack, etc.)
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Enable CORS
app.use(cors());

// Parse JSON and URL-encoded requests for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== DATABASE CONNECTION ==========
connectDB();

// ========== ROUTES IMPORT ==========
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const transactionRoutes = require('./src/routes/transaction');
const budgetRoutes = require('./src/routes/budget');
const paymentRoutes = require('./src/routes/paymentRoutes'); // ✅ NEW
const exchangeRoutes = require('./src/routes/exchange'); // NEW
const transferRoutes = require('./src/routes/transfer');

// ========== ROUTE REGISTRATION ==========
app.get('/', (req, res) => {
    res.json({
        message: 'FinFlow API is running 🚀',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            user: '/api/user',
            transactions: '/api/transactions',
            budgets: '/api/budgets',
            payment: '/api/payment'
        }
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/payment', paymentRoutes); // ✅ Payment routes registered
app.use('/api/exchange', exchangeRoutes); // Exchange routes registered
app.use('/api/transfer', transferRoutes);
// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured'
    });
});

// ========== ERROR HANDLING ==========

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path
    });
});

// General error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack || err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ========== SERVER STARTUP ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}/api`);
    console.log(`💳 Payment enabled: ${process.env.STRIPE_SECRET_KEY ? '✅ Yes' : '❌ No (add STRIPE_SECRET_KEY to .env)'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

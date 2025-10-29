const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const User = require('../models/User');
const { validateEmail, validatePassword } = require('../utils/validators');

// Generate JWT Token
const generateToken = (userId, email, walletAddress) => {
    return jwt.sign(
        { userId, email, walletAddress },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// ========== EMAIL/PASSWORD AUTHENTICATION ==========

// Traditional Signup Controller
exports.signup = async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            email,
            password: hashedPassword,
            fullName: fullName || '',
            authMethod: 'email',
            hasPassword: true,
        });

        await user.save();

        // Generate token
        const token = generateToken(user._id, user.email, null);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            authMethod: 'email',
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                balance: user.balance,
                currency: user.currency,
                authMethod: user.authMethod,
            },
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
};

// Traditional Login Controller
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user has password (wallet users might not have password yet)
        if (!user.password) {
            return res.status(401).json({ 
                error: 'This account uses wallet authentication. Please use your wallet to sign in or set a password first.' 
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id, user.email, user.walletAddress);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            authMethod: user.authMethod,
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                balance: user.balance,
                currency: user.currency,
                profileImage: user.profileImage,
                walletAddress: user.walletAddress,
                walletType: user.walletType,
                authMethod: user.authMethod,
                hasPassword: user.hasPassword,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

// ========== WEB3 WALLET AUTHENTICATION ==========

// Step 1: Request nonce for wallet signature
exports.requestNonce = async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }

        // Validate Ethereum address format
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Check if user exists
        let user = await User.findOne({ walletAddress: normalizedAddress });

        if (!user) {
            // Create new user with wallet
            user = new User({
                walletAddress: normalizedAddress,
                authMethod: 'wallet',
                hasPassword: false,
                nonce: Math.floor(Math.random() * 1000000).toString(),
            });
            await user.save();
        } else {
            // Generate new nonce for existing user
            user.nonce = Math.floor(Math.random() * 1000000).toString();
            await user.save();
        }

        res.json({
            success: true,
            nonce: user.nonce,
            message: `Please sign this message to authenticate: ${user.nonce}`,
            isNewUser: !user.hasPassword,
        });
    } catch (error) {
        console.error('Request nonce error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Step 2: Verify wallet signature and login/signup
exports.verifyWallet = async (req, res) => {
    try {
        const { walletAddress, signature, walletType } = req.body;

        if (!walletAddress || !signature) {
            return res.status(400).json({ error: 'Wallet address and signature are required' });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Find user
        const user = await User.findOne({ walletAddress: normalizedAddress });
        if (!user) {
            return res.status(404).json({ error: 'Please request nonce first' });
        }

        // Verify signature
        const message = `Please sign this message to authenticate: ${user.nonce}`;
        const recoveredAddress = ethers.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() !== normalizedAddress) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Update wallet type if provided
        if (walletType && ['metamask', 'walletconnect'].includes(walletType)) {
            user.walletType = walletType;
        }

        // Update last login
        user.lastLogin = new Date();
        
        // Generate new nonce for next authentication
        user.nonce = Math.floor(Math.random() * 1000000).toString();
        
        await user.save();

        // Generate token
        const token = generateToken(user._id, user.email, user.walletAddress);

        res.json({
            success: true,
            message: user.hasPassword ? 'Login successful' : 'Wallet connected successfully',
            token,
            authMethod: user.authMethod,
            requiresPassword: !user.hasPassword,
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                balance: user.balance,
                currency: user.currency,
                profileImage: user.profileImage,
                walletAddress: user.walletAddress,
                walletType: user.walletType,
                authMethod: user.authMethod,
                hasPassword: user.hasPassword,
            },
        });
    } catch (error) {
        console.error('Verify wallet error:', error);
        res.status(500).json({ error: 'Server error during wallet verification' });
    }
};

// Step 3: Set password for wallet users (optional but recommended)
exports.setPasswordForWallet = async (req, res) => {
    try {
        const { password, email } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.hasPassword) {
            return res.status(400).json({ error: 'User already has a password. Use change password instead.' });
        }

        // Hash password
        user.password = await bcrypt.hash(password, 10);
        user.hasPassword = true;
        
        // Update email if provided
        if (email) {
            if (!validateEmail(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
            
            // Check if email is already taken
            const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
            if (existingUser) {
                return res.status(400).json({ error: 'Email already in use' });
            }
            
            user.email = email;
        }

        // Update auth method to hybrid (can use both wallet and password)
        user.authMethod = 'hybrid';

        await user.save();

        res.json({
            success: true,
            message: 'Password set successfully. You can now login with email/password or wallet.',
            user: {
                id: user._id,
                email: user.email,
                walletAddress: user.walletAddress,
                authMethod: user.authMethod,
                hasPassword: user.hasPassword,
            },
        });
    } catch (error) {
        console.error('Set password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Verify Token Controller
exports.verifyToken = async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                email: req.user.email,
                fullName: req.user.fullName,
                balance: req.user.balance,
                currency: req.user.currency,
                walletAddress: req.user.walletAddress,
                walletType: req.user.walletType,
                authMethod: req.user.authMethod,
                hasPassword: req.user.hasPassword,
            },
        });
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
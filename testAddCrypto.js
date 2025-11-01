// testAddCrypto.js - Script to add test crypto assets to your account
// Run this once to add some crypto to your account for testing

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'your_mongodb_connection_string')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

const User = require('./src/models/User');

async function addTestCryptoAssets() {
    try {
        // Find your user by email
        const userEmail = 'olonadenifemi@gmail.com';
        const user = await User.findOne({ email: userEmail });

        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log(`\n📝 Adding crypto assets to ${user.email}...`);

        // Add some test crypto assets
        user.addCryptoAsset('BTC', 0.0234);
        user.addCryptoAsset('ETH', 0.542);
        user.addCryptoAsset('BNB', 2.34);
        user.addCryptoAsset('SOL', 12.5);
        user.addCryptoAsset('USDT', 500);

        // Save the user
        await user.save();

        console.log('✅ Crypto assets added successfully!');
        console.log('\n📊 Current Crypto Holdings:');
        const cryptoAssets = user.getAllCryptoAssets();
        console.log(JSON.stringify(cryptoAssets, null, 2));

        // Calculate total portfolio value
        const totalPortfolio = await user.getTotalPortfolioUSD();
        console.log(`\n💰 Total Portfolio Value: $${totalPortfolio.toFixed(2)}`);
        console.log(`💵 Fiat Balance: $${user.balanceUSD.toFixed(2)}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
addTestCryptoAssets();

// ============================================
// ALTERNATIVE: MongoDB Compass Query
// ============================================
// If you prefer to use MongoDB Compass, use this query:
/*
// Filter: 
{ "email": "olonadenifemi@gmail.com" }

// Update:
{
  "$set": {
    "cryptoAssets": {
      "BTC": 0.0234,
      "ETH": 0.542,
      "BNB": 2.34,
      "SOL": 12.5,
      "USDT": 500
    }
  }
}
*/

// ============================================
// ALTERNATIVE: Test via API Endpoint
// ============================================
// You can also create a test endpoint temporarily:
/*
// In your routes/user.js or create routes/test.js
router.post('/test/add-crypto', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        user.addCryptoAsset('BTC', 0.0234);
        user.addCryptoAsset('ETH', 0.542);
        user.addCryptoAsset('BNB', 2.34);
        user.addCryptoAsset('SOL', 12.5);
        user.addCryptoAsset('USDT', 500);
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Test crypto assets added',
            cryptoAssets: user.getAllCryptoAssets()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Then call: POST http://localhost:5000/api/test/add-crypto
// With Authorization: Bearer YOUR_TOKEN
*/
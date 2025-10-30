// scripts/migrateCurrencyData.js
// Run this script once to migrate existing data to the new currency system

const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { convertCurrency } = require('../services/currencyService');
require('dotenv').config();

const migrateCurrencyData = async () => {
    try {
        console.log('🔄 Starting currency migration...');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Migrate Users
        console.log('\n📊 Migrating user balances...');
        const users = await User.find({});
        let userCount = 0;

        for (const user of users) {
            // If balance field exists (old schema), convert to balanceUSD
            if (user.balance !== undefined && user.balanceUSD === undefined) {
                const userCurrency = user.currency || 'USD';
                
                // Convert balance to USD
                const balanceInUSD = await convertCurrency(
                    user.balance,
                    userCurrency,
                    'USD'
                );

                user.balanceUSD = balanceInUSD;
                user.baseCurrency = userCurrency;
                
                // Remove old balance field
                user.balance = undefined;
                
                await user.save();
                userCount++;
                
                console.log(`  ✓ Migrated user ${user.email || user._id}: ${user.balance} ${userCurrency} → ${balanceInUSD.toFixed(2)} USD`);
            }
        }
        console.log(`✅ Migrated ${userCount} users`);

        // Migrate Transactions
        console.log('\n💸 Migrating transactions...');
        const transactions = await Transaction.find({});
        let txCount = 0;

        for (const tx of transactions) {
            // If amountUSD doesn't exist, calculate it
            if (!tx.amountUSD) {
                const txCurrency = tx.currency || 'USD';
                
                // Convert amount to USD
                const amountInUSD = await convertCurrency(
                    tx.amount,
                    txCurrency,
                    'USD'
                );

                tx.amountUSD = amountInUSD;
                
                // Store exchange rate for historical reference
                if (!tx.exchangeRate) {
                    const rate = await convertCurrency(1, txCurrency, 'USD');
                    tx.exchangeRate = rate;
                }

                await tx.save();
                txCount++;
                
                if (txCount % 100 === 0) {
                    console.log(`  Processed ${txCount} transactions...`);
                }
            }
        }
        console.log(`✅ Migrated ${txCount} transactions`);

        console.log('\n✨ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
};

// Run migration
migrateCurrencyData();
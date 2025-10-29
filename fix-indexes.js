const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Get current indexes
        const indexes = await usersCollection.indexes();
        console.log('\n📋 Current indexes:', indexes);

        // Drop old email index if it exists
        try {
            await usersCollection.dropIndex('email_1');
            console.log('✅ Dropped old email_1 index');
        } catch (error) {
            console.log('ℹ️  email_1 index does not exist');
        }

        // Drop old walletAddress index if it exists
        try {
            await usersCollection.dropIndex('walletAddress_1');
            console.log('✅ Dropped old walletAddress_1 index');
        } catch (error) {
            console.log('ℹ️  walletAddress_1 index does not exist');
        }

        // Create new sparse indexes
        await usersCollection.createIndex(
            { email: 1 }, 
            { sparse: true, unique: true }
        );
        console.log('✅ Created sparse email index');

        await usersCollection.createIndex(
            { walletAddress: 1 }, 
            { sparse: true, unique: true }
        );
        console.log('✅ Created sparse walletAddress index');

        // Verify new indexes
        const newIndexes = await usersCollection.indexes();
        console.log('\n📋 New indexes:', newIndexes);

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

fixIndexes();
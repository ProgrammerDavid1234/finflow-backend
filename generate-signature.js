const { ethers } = require('ethers');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function generateSignature() {
    // Option 1: Create random wallet
    console.log('\n=== Choose Option ===');
    console.log('1. Create a new random wallet');
    console.log('2. Use your own private key\n');
    
    rl.question('Enter option (1 or 2): ', async (option) => {
        let wallet;
        
        if (option === '1') {
            wallet = ethers.Wallet.createRandom();
            console.log('\n✓ Random wallet created!');
            console.log('⚠️  SAVE THIS PRIVATE KEY:', wallet.privateKey);
        } else {
            rl.question('Enter your private key: ', async (privateKey) => {
                try {
                    wallet = new ethers.Wallet(privateKey);
                    console.log('\n✓ Wallet loaded!');
                } catch (error) {
                    console.log('❌ Invalid private key');
                    rl.close();
                    return;
                }
                
                await continueWithWallet(wallet);
            });
            return;
        }
        
        await continueWithWallet(wallet);
    });
}

async function continueWithWallet(wallet) {
    console.log('\n=== Wallet Details ===');
    console.log('Address:', wallet.address);
    
    rl.question('\nEnter the nonce from API (or press Enter for test nonce): ', async (inputNonce) => {
        const nonce = inputNonce || '123456';
        const message = `Please sign this message to authenticate: ${nonce}`;
        
        console.log('\n=== Signing Message ===');
        console.log('Message:', message);
        
        const signature = await wallet.signMessage(message);
        
        console.log('\n=== COPY THESE FOR POSTMAN ===');
        console.log('\n📋 Request Body for /api/auth/wallet/verify:');
        console.log(JSON.stringify({
            walletAddress: wallet.address,
            signature: signature,
            walletType: 'metamask'
        }, null, 2));
        
        console.log('\n✓ Done! Use the JSON above in Postman.\n');
        rl.close();
    });
}

generateSignature();
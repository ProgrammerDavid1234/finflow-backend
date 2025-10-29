const { ethers } = require('ethers');

// Create a test wallet (or use your own private key)
const wallet = ethers.Wallet.createRandom();
// OR use existing wallet:
// const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY_HERE');

console.log('========================================');
console.log('Test Wallet Details:');
console.log('========================================');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('========================================\n');

// Function to sign a message
async function signMessage(message) {
    const signature = await wallet.signMessage(message);
    return signature;
}

// Test the flow
async function testWalletAuth() {
    const walletAddress = wallet.address;
    
    console.log('Step 1: Request Nonce');
    console.log('POST http://localhost:5000/api/auth/wallet/nonce');
    console.log('Body:', JSON.stringify({ walletAddress }, null, 2));
    console.log('\n');
    
    // Simulate nonce (in real test, you'd get this from API)
    const nonce = '123456';
    const message = `Please sign this message to authenticate: ${nonce}`;
    
    console.log('Step 2: Sign Message');
    console.log('Message to sign:', message);
    
    const signature = await signMessage(message);
    console.log('Signature:', signature);
    console.log('\n');
    
    console.log('Step 3: Verify Signature');
    console.log('POST http://localhost:5000/api/auth/wallet/verify');
    console.log('Body:', JSON.stringify({
        walletAddress,
        signature,
        walletType: 'metamask'
    }, null, 2));
}

// Run the test
testWalletAuth().catch(console.error);
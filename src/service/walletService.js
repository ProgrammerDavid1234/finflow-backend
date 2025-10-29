import { ethers } from 'ethers';
import { requestWalletNonce, verifyWalletSignature } from './api';

// For MetaMask Mobile (using deep linking)
export const connectMetaMask = async () => {
    try {
        // Check if MetaMask is installed
        if (typeof window.ethereum !== 'undefined') {
            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            return accounts[0];
        } else {
            // Open MetaMask app via deep link
            const dappUrl = 'yourapp://'; // Your app's deep link
            const metamaskDeepLink = `https://metamask.app.link/dapp/${dappUrl}`;
            Linking.openURL(metamaskDeepLink);
            throw new Error('Please install MetaMask');
        }
    } catch (error) {
        console.error('MetaMask connection error:', error);
        throw error;
    }
};

// Sign message with wallet
export const signMessageWithWallet = async (walletAddress, message) => {
    try {
        if (typeof window.ethereum !== 'undefined') {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const signature = await signer.signMessage(message);
            return signature;
        } else {
            throw new Error('Wallet not available');
        }
    } catch (error) {
        console.error('Sign message error:', error);
        throw error;
    }
};

// Complete wallet authentication flow
export const authenticateWithWallet = async (walletType = 'metamask') => {
    try {
        // Step 1: Connect wallet and get address
        const walletAddress = await connectMetaMask();
        
        // Step 2: Request nonce from backend
        const nonceResponse = await requestWalletNonce(walletAddress);
        
        if (!nonceResponse.success) {
            throw new Error(nonceResponse.error || 'Failed to get nonce');
        }
        
        // Step 3: Sign the message
        const message = nonceResponse.message;
        const signature = await signMessageWithWallet(walletAddress, message);
        
        // Step 4: Verify signature with backend
        const verifyResponse = await verifyWalletSignature(
            walletAddress, 
            signature, 
            walletType
        );
        
        return verifyResponse;
    } catch (error) {
        console.error('Wallet authentication error:', error);
        throw error;
    }
};


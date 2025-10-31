// test-webhook.js
// Run this to simulate Stripe webhook and test automatic balance update

const axios = require('axios');
require('dotenv').config();

const testWebhook = async () => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Your payment intent ID from the create-intent response
    const paymentIntentId = 'pi_3SOJ5aLKGXJOx4Zs1RUtbfaJ';
    
    try {
        // Get the actual payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        console.log('Payment Intent Status:', paymentIntent.status);
        console.log('Payment Intent ID:', paymentIntent.id);
        console.log('Amount:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
        
        // If payment is not succeeded, you need to complete it first
        if (paymentIntent.status === 'requires_payment_method' || 
            paymentIntent.status === 'requires_confirmation') {
            
            console.log('\n⚠️  Payment not completed yet!');
            console.log('In a real app, user would complete payment in Stripe payment sheet.');
            console.log('For testing, you can confirm it manually:\n');
            
            // Confirm payment with test card (TEST MODE ONLY)
            const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: 'pm_card_visa', // Stripe test payment method
            });
            
            console.log('✅ Payment confirmed in test mode!');
            console.log('Status:', confirmed.status);
        }
        
        // Now simulate the webhook
        console.log('\n📡 Simulating webhook call to your backend...\n');
        
        const webhookEvent = {
            id: 'evt_test_' + Date.now(),
            object: 'event',
            type: 'payment_intent.succeeded',
            data: {
                object: paymentIntent
            }
        };
        
        // Call your webhook endpoint
        const response = await axios.post(
            'http://localhost:5000/api/payment/webhook',
            webhookEvent,
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
        
        console.log('✅ Webhook processed:', response.data);
        console.log('\n🎉 Balance should be updated now! Check your user profile.');
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
};

testWebhook();
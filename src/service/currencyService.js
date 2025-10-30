const axios = require('axios');

// Cache for exchange rates (updates every 1 hour)
let cachedRates = null;
let lastFetchTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fallback rates if API fails
const FALLBACK_RATES = {
    USD: 1,
    EUR: 0.85,
    GBP: 0.73,
    NGN: 1500,
    BTC: 0.000023,
    ETH: 0.00031,
};

// Get exchange rates from API or cache
async function getExchangeRates() {
    try {
        // Check if we have cached rates that are still valid
        const now = Date.now();
        if (cachedRates && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
            console.log('Using cached exchange rates');
            return cachedRates;
        }

        // Fetch new rates from API
        console.log('Fetching fresh exchange rates...');
        
        const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
        
        if (!API_KEY) {
            console.warn('Exchange rate API key not found, using fallback rates');
            return FALLBACK_RATES;
        }

        // Using exchangerate-api.com (free tier: 1500 requests/month)
        const response = await axios.get(
            `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`,
            { timeout: 5000 }
        );

        if (response.data && response.data.conversion_rates) {
            const rates = response.data.conversion_rates;
            
            // Add crypto rates (you might want to fetch these from a crypto API)
            // For now, using approximate values
            cachedRates = {
                USD: 1,
                EUR: rates.EUR || FALLBACK_RATES.EUR,
                GBP: rates.GBP || FALLBACK_RATES.GBP,
                NGN: rates.NGN || FALLBACK_RATES.NGN,
                BTC: 1 / 43000, // Approximate BTC price in USD
                ETH: 1 / 2300,  // Approximate ETH price in USD
            };
            
            lastFetchTime = now;
            console.log('Exchange rates updated successfully');
            return cachedRates;
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error fetching exchange rates:', error.message);
        
        // If we have cached rates (even if expired), use them
        if (cachedRates) {
            console.log('Using expired cached rates due to API error');
            return cachedRates;
        }
        
        // Otherwise use fallback
        console.log('Using fallback exchange rates');
        return FALLBACK_RATES;
    }
}

// Convert currency
async function convertCurrency(amount, fromCurrency, toCurrency) {
    try {
        // Validate inputs
        if (isNaN(amount) || amount < 0) {
            throw new Error('Invalid amount');
        }

        if (!fromCurrency || !toCurrency) {
            throw new Error('Currency codes are required');
        }

        // If same currency, return original amount
        if (fromCurrency === toCurrency) {
            return parseFloat(amount);
        }

        // Get exchange rates
        const rates = await getExchangeRates();

        // Validate currencies
        if (!rates[fromCurrency]) {
            throw new Error(`Unsupported currency: ${fromCurrency}`);
        }
        if (!rates[toCurrency]) {
            throw new Error(`Unsupported currency: ${toCurrency}`);
        }

        // Convert: amount in fromCurrency -> USD -> toCurrency
        const amountInUSD = parseFloat(amount) / rates[fromCurrency];
        const convertedAmount = amountInUSD * rates[toCurrency];

        return parseFloat(convertedAmount.toFixed(8)); // Keep 8 decimals for crypto
    } catch (error) {
        console.error('Currency conversion error:', error);
        throw error;
    }
}

// Get exchange rate between two currencies
async function getExchangeRate(fromCurrency, toCurrency) {
    try {
        const rates = await getExchangeRates();
        
        if (!rates[fromCurrency] || !rates[toCurrency]) {
            throw new Error('Invalid currency');
        }

        // Rate from fromCurrency to toCurrency
        const rate = rates[toCurrency] / rates[fromCurrency];
        return parseFloat(rate.toFixed(8));
    } catch (error) {
        console.error('Get exchange rate error:', error);
        throw error;
    }
}

// Format currency with proper symbol and decimals
function formatCurrency(amount, currency) {
    const symbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        NGN: '₦',
        BTC: '₿',
        ETH: 'Ξ',
    };

    const symbol = symbols[currency] || currency;
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount)) {
        return `${symbol}0.00`;
    }

    // Use more decimals for crypto
    if (['BTC', 'ETH'].includes(currency)) {
        return `${symbol}${numericAmount.toFixed(8)}`;
    }

    return `${symbol}${numericAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

module.exports = {
    getExchangeRates,
    convertCurrency,
    getExchangeRate,
    formatCurrency,
};
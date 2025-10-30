// src/services/currencyService.js
const axios = require('axios');

// Exchange rates relative to USD (base currency)
// You can fetch these from an API like exchangerate-api.com or fixer.io
const STATIC_RATES = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    NGN: 1550,
    BTC: 0.000023,
    ETH: 0.00042
};

// Cache for exchange rates
let cachedRates = { ...STATIC_RATES };
let lastFetchTime = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Fetch live exchange rates from external API
 * Free API options:
 * - https://exchangerate-api.com (1500 requests/month free)
 * - https://fixer.io (100 requests/month free)
 * - https://openexchangerates.org (1000 requests/month free)
 */
const fetchLiveRates = async () => {
    try {
        // Example using exchangerate-api.com (replace with your API key)
        const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
        
        if (!API_KEY) {
            console.log('No API key found, using static rates');
            return STATIC_RATES;
        }

        const response = await axios.get(
            `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`
        );

        if (response.data && response.data.conversion_rates) {
            const rates = {
                USD: 1,
                EUR: response.data.conversion_rates.EUR || STATIC_RATES.EUR,
                GBP: response.data.conversion_rates.GBP || STATIC_RATES.GBP,
                NGN: response.data.conversion_rates.NGN || STATIC_RATES.NGN,
                BTC: response.data.conversion_rates.BTC || STATIC_RATES.BTC,
                ETH: STATIC_RATES.ETH, // Crypto rates not in standard APIs
            };

            cachedRates = rates;
            lastFetchTime = Date.now();
            return rates;
        }

        return STATIC_RATES;
    } catch (error) {
        console.error('Error fetching exchange rates:', error.message);
        return STATIC_RATES;
    }
};

/**
 * Get current exchange rates (with caching)
 */
const getExchangeRates = async () => {
    const now = Date.now();
    
    // Return cached rates if still valid
    if (lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
        return cachedRates;
    }

    // Fetch new rates
    return await fetchLiveRates();
};

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {number} Converted amount
 */
const convertCurrency = async (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) {
        return amount;
    }

    const rates = await getExchangeRates();

    // Convert to USD first, then to target currency
    const amountInUSD = amount / rates[fromCurrency];
    const convertedAmount = amountInUSD * rates[toCurrency];

    return parseFloat(convertedAmount.toFixed(8));
};

/**
 * Get exchange rate between two currencies
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {number} Exchange rate
 */
const getExchangeRate = async (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) {
        return 1;
    }

    const rates = await getExchangeRates();
    const rate = rates[toCurrency] / rates[fromCurrency];
    
    return parseFloat(rate.toFixed(8));
};

/**
 * Format currency amount with symbol
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
const formatCurrency = (amount, currency) => {
    const symbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        NGN: '₦',
        BTC: '₿',
        ETH: 'Ξ'
    };

    const symbol = symbols[currency] || currency;
    const decimals = ['BTC', 'ETH'].includes(currency) ? 8 : 2;
    
    return `${symbol}${amount.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}`;
};

/**
 * Get all supported currencies with current rates
 * @returns {Object} Currency information
 */
const getSupportedCurrencies = async () => {
    const rates = await getExchangeRates();
    
    return {
        USD: { name: 'US Dollar', symbol: '$', rate: rates.USD },
        EUR: { name: 'Euro', symbol: '€', rate: rates.EUR },
        GBP: { name: 'British Pound', symbol: '£', rate: rates.GBP },
        NGN: { name: 'Nigerian Naira', symbol: '₦', rate: rates.NGN },
        BTC: { name: 'Bitcoin', symbol: '₿', rate: rates.BTC },
        ETH: { name: 'Ethereum', symbol: 'Ξ', rate: rates.ETH }
    };
};

module.exports = {
    convertCurrency,
    getExchangeRate,
    getExchangeRates,
    formatCurrency,
    getSupportedCurrencies,
    fetchLiveRates
};
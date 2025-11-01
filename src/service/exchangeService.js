// service/exchangeService.js
const axios = require('axios');

// Cache for crypto rates (updates every 5 minutes)
let cachedCryptoRates = null;
let lastCryptoFetchTime = null;
const CRYPTO_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Supported cryptocurrencies with fallback rates (price in USD)
const FALLBACK_CRYPTO_RATES = {
    BTC: 43000,
    ETH: 2300,
    BNB: 320,
    SOL: 108,
    USDT: 1,
    USDC: 1,
    ADA: 0.41,
    XRP: 0.54,
    MATIC: 0.76,
    DOT: 5.2,
    AVAX: 22,
    LINK: 14.5,
};

// Supported fiat currencies
const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN'];

// Get crypto exchange rates (price in USD)
async function getCryptoRates() {
    try {
        const now = Date.now();
        
        // Return cached rates if still valid
        if (cachedCryptoRates && lastCryptoFetchTime && (now - lastCryptoFetchTime) < CRYPTO_CACHE_DURATION) {
            return cachedCryptoRates;
        }

        console.log('Fetching fresh crypto rates...');

        // Using CoinGecko API (free, no API key needed)
        const cryptoIds = 'bitcoin,ethereum,binancecoin,solana,tether,usd-coin,cardano,ripple,matic-network,polkadot,avalanche-2,chainlink';
        
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=usd`,
            { timeout: 5000 }
        );

        if (response.data) {
            cachedCryptoRates = {
                BTC: response.data.bitcoin?.usd || FALLBACK_CRYPTO_RATES.BTC,
                ETH: response.data.ethereum?.usd || FALLBACK_CRYPTO_RATES.ETH,
                BNB: response.data.binancecoin?.usd || FALLBACK_CRYPTO_RATES.BNB,
                SOL: response.data.solana?.usd || FALLBACK_CRYPTO_RATES.SOL,
                USDT: response.data.tether?.usd || FALLBACK_CRYPTO_RATES.USDT,
                USDC: response.data['usd-coin']?.usd || FALLBACK_CRYPTO_RATES.USDC,
                ADA: response.data.cardano?.usd || FALLBACK_CRYPTO_RATES.ADA,
                XRP: response.data.ripple?.usd || FALLBACK_CRYPTO_RATES.XRP,
                MATIC: response.data['matic-network']?.usd || FALLBACK_CRYPTO_RATES.MATIC,
                DOT: response.data.polkadot?.usd || FALLBACK_CRYPTO_RATES.DOT,
                AVAX: response.data['avalanche-2']?.usd || FALLBACK_CRYPTO_RATES.AVAX,
                LINK: response.data.chainlink?.usd || FALLBACK_CRYPTO_RATES.LINK,
            };
            
            lastCryptoFetchTime = now;
            console.log('Crypto rates updated successfully');
            return cachedCryptoRates;
        }
    } catch (error) {
        console.error('Error fetching crypto rates:', error.message);
        
        // Use cached rates if available
        if (cachedCryptoRates) {
            console.log('Using expired cached crypto rates');
            return cachedCryptoRates;
        }
    }
    
    // Fallback to hardcoded rates
    console.log('Using fallback crypto rates');
    return FALLBACK_CRYPTO_RATES;
}

// Convert between fiat and crypto
async function convertCurrencyToCrypto(amount, fromCurrency, toCurrency) {
    try {
        const { convertCurrency, getExchangeRates } = require('./currencyService');
        
        amount = parseFloat(amount);
        
        if (isNaN(amount) || amount < 0) {
            throw new Error('Invalid amount');
        }

        // Get rates
        const fiatRates = await getExchangeRates();
        const cryptoRates = await getCryptoRates();

        const isCryptoFrom = !FIAT_CURRENCIES.includes(fromCurrency);
        const isCryptoTo = !FIAT_CURRENCIES.includes(toCurrency);

        // Case 1: Fiat to Fiat (use existing function)
        if (!isCryptoFrom && !isCryptoTo) {
            return await convertCurrency(amount, fromCurrency, toCurrency);
        }

        // Case 2: Fiat to Crypto
        if (!isCryptoFrom && isCryptoTo) {
            // Convert fiat to USD first
            const amountInUSD = await convertCurrency(amount, fromCurrency, 'USD');
            // Then convert USD to crypto
            const cryptoPrice = cryptoRates[toCurrency];
            if (!cryptoPrice) {
                throw new Error(`Unsupported crypto: ${toCurrency}`);
            }
            return parseFloat((amountInUSD / cryptoPrice).toFixed(8));
        }

        // Case 3: Crypto to Fiat
        if (isCryptoFrom && !isCryptoTo) {
            // Convert crypto to USD first
            const cryptoPrice = cryptoRates[fromCurrency];
            if (!cryptoPrice) {
                throw new Error(`Unsupported crypto: ${fromCurrency}`);
            }
            const amountInUSD = amount * cryptoPrice;
            // Then convert USD to target fiat
            return await convertCurrency(amountInUSD, 'USD', toCurrency);
        }

        // Case 4: Crypto to Crypto
        if (isCryptoFrom && isCryptoTo) {
            const fromPrice = cryptoRates[fromCurrency];
            const toPrice = cryptoRates[toCurrency];
            
            if (!fromPrice || !toPrice) {
                throw new Error('Unsupported crypto currency');
            }
            
            // Convert to USD then to target crypto
            const amountInUSD = amount * fromPrice;
            return parseFloat((amountInUSD / toPrice).toFixed(8));
        }

    } catch (error) {
        console.error('Currency/Crypto conversion error:', error);
        throw error;
    }
}

// Get exchange rate between any two currencies (fiat or crypto)
async function getUnifiedExchangeRate(fromCurrency, toCurrency) {
    try {
        const result = await convertCurrencyToCrypto(1, fromCurrency, toCurrency);
        return parseFloat(result.toFixed(8));
    } catch (error) {
        console.error('Get exchange rate error:', error);
        throw error;
    }
}

// Get all supported currencies with rates
async function getAllSupportedCurrencies() {
    try {
        const { getExchangeRates } = require('./currencyService');
        
        const fiatRates = await getExchangeRates();
        const cryptoRates = await getCryptoRates();

        const currencies = [];

        // Add fiat currencies
        const fiatInfo = {
            USD: { name: 'US Dollar', symbol: '$', icon: '💵', type: 'fiat' },
            EUR: { name: 'Euro', symbol: '€', icon: '💶', type: 'fiat' },
            GBP: { name: 'British Pound', symbol: '£', icon: '💷', type: 'fiat' },
            NGN: { name: 'Nigerian Naira', symbol: '₦', icon: '💴', type: 'fiat' },
        };

        Object.keys(fiatInfo).forEach(code => {
            currencies.push({
                symbol: code,
                name: fiatInfo[code].name,
                icon: fiatInfo[code].icon,
                type: 'fiat',
                rateToUSD: fiatRates[code] || 1,
                priceUSD: 1 / (fiatRates[code] || 1),
            });
        });

        // Add crypto currencies
        const cryptoInfo = {
            BTC: { name: 'Bitcoin', icon: '₿', blockchain: 'Bitcoin', color: '#F7931A' },
            ETH: { name: 'Ethereum', icon: 'Ξ', blockchain: 'Ethereum', color: '#627EEA' },
            BNB: { name: 'Binance Coin', icon: 'Ⓑ', blockchain: 'BSC', color: '#F3BA2F' },
            SOL: { name: 'Solana', icon: '◎', blockchain: 'Solana', color: '#14F195' },
            USDT: { name: 'Tether', icon: '₮', blockchain: 'Multi-chain', color: '#26A17B', type: 'stablecoin' },
            USDC: { name: 'USD Coin', icon: '$', blockchain: 'Multi-chain', color: '#2775CA', type: 'stablecoin' },
            ADA: { name: 'Cardano', icon: '₳', blockchain: 'Cardano', color: '#0033AD' },
            XRP: { name: 'Ripple', icon: '✕', blockchain: 'XRP Ledger', color: '#23292F' },
            MATIC: { name: 'Polygon', icon: 'Ⓜ', blockchain: 'Polygon', color: '#8247E5' },
        };

        Object.keys(cryptoInfo).forEach(code => {
            const price = cryptoRates[code];
            currencies.push({
                symbol: code,
                name: cryptoInfo[code].name,
                icon: cryptoInfo[code].icon,
                type: cryptoInfo[code].type || 'crypto',
                blockchain: cryptoInfo[code].blockchain,
                color: cryptoInfo[code].color,
                priceUSD: price,
                rateToUSD: 1 / price, // How many units = 1 USD
            });
        });

        return currencies;
    } catch (error) {
        console.error('Get all currencies error:', error);
        throw error;
    }
}

// Calculate exchange fees (0.1% fee)
function calculateExchangeFee(amount) {
    const FEE_PERCENTAGE = 0.001; // 0.1%
    return parseFloat((amount * FEE_PERCENTAGE).toFixed(8));
}

module.exports = {
    getCryptoRates,
    convertCurrencyToCrypto,
    getUnifiedExchangeRate,
    getAllSupportedCurrencies,
    calculateExchangeFee,
};
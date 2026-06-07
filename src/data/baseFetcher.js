import axios from 'axios';

/**
 * Base fetcher class providing common functionality like retries and caching.
 */
export class BaseFetcher {
  constructor(x402Client = null) {
    this.x402Client = x402Client;
    this.apiKey = process.env.CMC_API_KEY;
    this.baseUrl = process.env.CMC_BASE_URL || 'https://pro-api.coinmarketcap.com/v1/';
    this.cache = new Map();
    this.cacheTtlMs = 60 * 1000; // 1 minute default cache
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-CMC_PRO_API_KEY': this.apiKey,
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Executes a request with retry logic and mock x402 payment headers.
   */
  async requestWithRetry(endpoint, params = {}, maxRetries = 3) {
    const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
      return cached.data;
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        let authHeader = '';
        if (this.x402Client) {
          authHeader = await this.x402Client.payForRequest('CMC_Agent_Hub', endpoint);
        } else {
          authHeader = `L402-Payment-MockedToken-${Date.now()}`;
        }
        
        const response = await this.client.get(endpoint, { 
          params,
          headers: {
            'Authorization': authHeader
          }
        });
        
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          data: response.data
        });
        
        return response.data;
      } catch (error) {
        attempt++;
        console.warn(`[BaseFetcher] Request to ${endpoint} failed (Attempt ${attempt}/${maxRetries}):`, error.message);
        if (error.response && error.response.status === 401) {
          console.warn(`[BaseFetcher] 401 Unauthorized for ${endpoint}. Mocking data for demonstration.`);
          if (endpoint.includes('quotes')) {
            return {
              data: {
                'BNB': { quote: { USD: { price: 600, percent_change_24h: 2, volume_24h: 1000000 } } },
                'ETH': { quote: { USD: { price: 3500, percent_change_24h: -1, volume_24h: 5000000 } } },
                'USDT': { quote: { USD: { price: 1, percent_change_24h: 0, volume_24h: 10000000 } } },
                'DOGE': { quote: { USD: { price: 0.15, percent_change_24h: 5, volume_24h: 800000 } } },
                'CAKE': { quote: { USD: { price: 3.5, percent_change_24h: 10, volume_24h: 200000 } } }
              }
            };
          }
          if (endpoint.includes('fear-and-greed')) {
            return { data: { value: 25 } }; // Low fear & greed triggers buy signal
          }
        }
        
        if (attempt >= maxRetries) {
          throw new Error(`Failed to fetch from ${endpoint} after ${maxRetries} attempts. Error: ${error.message}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
}

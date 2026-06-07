import { BaseFetcher } from './baseFetcher.js';

/**
 * Fetches real-time prices and basic market metrics for tokens.
 */
export class PriceFetcher extends BaseFetcher {
  constructor(x402Client = null) {
    super(x402Client);
    this.cacheTtlMs = 30 * 1000; // 30 seconds cache for prices
  }

  /**
   * Fetches latest price data for a list of symbols.
   * @param {string[]} symbols Array of token symbols (e.g., ['BNB', 'BTC'])
   */
  async getPrices(symbols) {
    try {
      console.log(`[PriceFetcher] Fetching prices for: ${symbols.join(', ')}`);
      
      // Simulate x402 payment for data
      if (this.x402Client) {
        await this.x402Client.payForRequest('CMC_Agent_Hub', 'cryptocurrency/quotes/latest');
      }

      // Use real CMC API
      const data = await this.requestWithRetry('cryptocurrency/quotes/latest', { symbol: symbols.join(',') });
      const mockData = {};
      
      if (data && data.data) {
        symbols.forEach(symbol => {
          const coin = data.data[symbol];
          if (coin) {
            mockData[symbol] = {
              symbol,
              price: coin.quote.USD.price,
              change24h: coin.quote.USD.percent_change_24h,
              volume: coin.quote.USD.volume_24h
            };
          }
        });
      }
      
      return mockData;
    } catch (error) {
      console.error('[PriceFetcher] Error:', error);
      throw error;
    }
  }
}

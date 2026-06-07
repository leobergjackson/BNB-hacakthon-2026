import { BaseFetcher } from './baseFetcher.js';

/**
 * Fetches Fear & Greed index and social sentiment scores.
 */
export class SentimentFetcher extends BaseFetcher {
  constructor(x402Client = null) {
    super(x402Client);
    this.cacheTtlMs = 5 * 60 * 1000; // 5 minutes cache for sentiment
  }

  /**
   * Fetches the global Fear & Greed Index.
   */
  async getFearGreedIndex() {
    try {
      console.log(`[SentimentFetcher] Fetching Fear & Greed Index...`);
      // Simulate x402 payment
      if (this.x402Client) {
        await this.x402Client.payForRequest('CMC_Agent_Hub', 'fear-and-greed/latest');
      }
      
      const data = await this.requestWithRetry('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest');
      if (data && data.data && data.data.value) {
        return parseInt(data.data.value, 10);
      }
      
      return 50; // Default neutral if missing
    } catch (error) {
      console.error('[SentimentFetcher] Error fetching F&G:', error);
      return 50; // Default neutral
    }
  }

  /**
   * Fetches social sentiment scores for specific symbols.
   * @param {string[]} symbols 
   */
  async getSocialSentiment(symbols) {
    try {
      console.log(`[SentimentFetcher] Fetching social sentiment for: ${symbols.join(', ')}`);
      // Simulate x402 payment
      if (this.x402Client) {
        await this.x402Client.payForRequest('CMC_Agent_Hub', 'social/sentiment/latest');
      }
      
      const mockData = {};
      symbols.forEach(symbol => {
        mockData[symbol] = Math.random(); // 0.0 (extreme fear/bearish) to 1.0 (extreme greed/bullish)
      });
      
      return mockData;
    } catch (error) {
      console.error('[SentimentFetcher] Error fetching sentiment:', error);
      throw error;
    }
  }
}

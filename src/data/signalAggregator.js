import { PriceFetcher } from './priceFetcher.js';
import { SentimentFetcher } from './sentimentFetcher.js';
import { DerivativesFetcher } from './derivativesFetcher.js';

/**
 * Aggregates data from all fetchers into a unified market state object.
 */
export class SignalAggregator {
  constructor(x402Client = null) {
    this.priceFetcher = new PriceFetcher(x402Client);
    this.sentimentFetcher = new SentimentFetcher(x402Client);
    this.derivativesFetcher = new DerivativesFetcher(x402Client);
  }

  /**
   * Determines the overall market regime based on Fear & Greed.
   */
  _calculateMarketRegime(fearGreedIndex) {
    if (fearGreedIndex > 70) return 'risk-on';
    if (fearGreedIndex < 30) return 'risk-off';
    return 'neutral';
  }

  /**
   * Builds the aggregated market state for a list of tokens.
   * @param {string[]} symbols 
   */
  async getAggregatedState(symbols) {
    try {
      console.log('[SignalAggregator] Aggregating market data...');

      // Fetch all data concurrently
      const [
        prices,
        fearGreedIndex,
        sentiments,
        fundingRates
      ] = await Promise.all([
        this.priceFetcher.getPrices(symbols),
        this.sentimentFetcher.getFearGreedIndex(),
        this.sentimentFetcher.getSocialSentiment(symbols),
        this.derivativesFetcher.getFundingRates(symbols)
      ]);

      const tokens = symbols.map(symbol => {
        const priceData = prices[symbol] || {};
        return {
          symbol,
          price: priceData.price || 0,
          change24h: priceData.change24h || 0,
          volume: priceData.volume || 0,
          sentimentScore: sentiments[symbol] || 0.5,
          fearGreedIndex: fearGreedIndex,
          fundingRate: fundingRates[symbol] || 0
        };
      });

      const marketRegime = this._calculateMarketRegime(fearGreedIndex);

      return {
        timestamp: Date.now(),
        tokens,
        marketRegime
      };
    } catch (error) {
      console.error('[SignalAggregator] Error aggregating data:', error);
      throw error;
    }
  }
}

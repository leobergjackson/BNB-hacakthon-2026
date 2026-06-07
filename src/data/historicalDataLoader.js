import { allowedTokens } from '../../config/tokens.js';

export class HistoricalDataLoader {
  /**
   * Generates pseudo-random historical data for backtesting.
   * Restricts to a subset of tokens for performance.
   */
  generateData(days) {
    const hours = days * 24;
    const timeline = [];
    
    // Subset of top 15 tokens to keep simulation fast but realistic
    const activeTokens = allowedTokens.slice(0, 15);
    
    // Initialize base states
    let globalFearGreed = 50;
    const tokenStates = activeTokens.map(t => ({
      symbol: t.symbol,
      price: t.symbol === 'BTCB' ? 60000 : t.symbol === 'ETH' ? 3000 : t.symbol === 'BNB' ? 500 : 100,
      sentiment: 0.5,
      funding: 0.0001
    }));

    let currentTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

    for (let i = 0; i < hours; i++) {
      // Random walk global fear/greed (drift towards 50)
      const fgChange = (Math.random() * 10 - 5) + (50 - globalFearGreed) * 0.05;
      globalFearGreed = Math.max(0, Math.min(100, globalFearGreed + fgChange));

      const hourState = {
        timestamp: currentTimestamp,
        marketRegime: globalFearGreed > 65 ? 'risk-on' : globalFearGreed < 35 ? 'risk-off' : 'neutral',
        tokens: []
      };

      for (const t of tokenStates) {
        // Price random walk correlated with FG index slightly
        const volatility = globalFearGreed < 30 ? 0.03 : 0.015; // 3% hourly vol in fear, 1.5% normally
        const fgBias = (globalFearGreed - 50) / 1000; 
        const priceChange = (Math.random() * volatility * 2 - volatility) + fgBias;
        
        t.price = Math.max(0.01, t.price * (1 + priceChange));
        
        // Sentiment random walk
        t.sentiment = Math.max(0, Math.min(1, t.sentiment + (Math.random() * 0.2 - 0.1)));
        
        // Funding rate 
        t.funding = (Math.random() * 0.002) - 0.001;

        hourState.tokens.push({
          symbol: t.symbol,
          price: parseFloat(t.price.toFixed(4)),
          change24h: priceChange * 100 * 24, // Rough approximation
          volume: Math.random() * 1000000,
          sentimentScore: t.sentiment,
          fearGreedIndex: globalFearGreed,
          fundingRate: t.funding
        });
      }

      timeline.push(hourState);
      currentTimestamp += 60 * 60 * 1000; // +1 hour
    }

    return timeline;
  }
}

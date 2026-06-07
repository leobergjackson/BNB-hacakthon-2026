/**
 * Generates raw, un-sized trading signals based on technical indicators and sentiment divergence.
 */
export class SentimentMomentum {
  /**
   * Mock RSI calculation based on 24h change.
   */
  _mockRSI(change24h) {
    // Simple heuristic: if up 5%, RSI is roughly 70. If down 5%, RSI is roughly 30.
    const normalized = Math.max(-10, Math.min(10, change24h)); // Cap between -10% and +10%
    return 50 + (normalized * 3); // -10% -> 20 RSI, +10% -> 80 RSI
  }

  /**
   * Mock MACD (Moving Average Convergence Divergence) histogram indicator.
   */
  _mockMACDMomentum(change24h) {
    // If change is positive, assume momentum is shifting up
    return change24h > 0 ? 'turning_up' : 'turning_down';
  }

  /**
   * Generates a trading signal combining technicals with sentiment divergence.
   * @param {Object} token - Token state including price, change24h, sentimentScore.
   * @param {Object} globalState - Global state including fearGreedIndex.
   * @returns {Object} { direction: 'BUY' | 'SELL' | 'HOLD', confidence: number, reasoning: string }
   */
  generateSignal(token, globalState) {
    const { fearGreedIndex } = globalState;
    const { change24h, sentimentScore } = token;
    
    const rsi = this._mockRSI(change24h);
    const momentum = this._mockMACDMomentum(change24h);
    
    // Rule 1: High social heat but negative momentum -> SELL/REDUCE
    if (sentimentScore > 0.8 && rsi < 50 && momentum === 'turning_down') {
      return { 
        direction: 'SELL', 
        confidence: 0.85, 
        reasoning: `High social heat (${sentimentScore.toFixed(2)}) but momentum is negative (RSI: ${rsi.toFixed(0)}). Divergence detected.` 
      };
    }
    
    // Rule 2: Extreme Fear but momentum turning -> BUY/ACCUMULATE
    if (fearGreedIndex < 25 && rsi > 30 && momentum === 'turning_up') {
      return { 
        direction: 'BUY', 
        confidence: 0.75, 
        reasoning: `Extreme fear (${fearGreedIndex}) but momentum is turning up. Accumulation signal.` 
      };
    }
    
    // Rule 3: Greed and overbought -> SELL
    if (fearGreedIndex > 75 && rsi > 70) {
       return { 
        direction: 'SELL', 
        confidence: 0.90, 
        reasoning: `Greed (${fearGreedIndex}) and overbought (RSI: ${rsi.toFixed(0)}). Taking profits.` 
      };
    }

    // Default neutral
    return { direction: 'HOLD', confidence: 0, reasoning: 'No strong divergence or momentum signal.' };
  }
}

/**
 * Calculates optimal trade size using a simplified Kelly criterion, adjusted by regime and drawdown proximity.
 */
export class PositionSizer {
  constructor() {
    this.maxDrawdownPercent = 30;
    this.maxPositionPercent = 5;
  }

  /**
   * Calculate position size in USD/USDT.
   * @param {Object} signal - { direction, confidence, reasoning }
   * @param {string} regime - 'risk-on' | 'risk-off' | 'neutral'
   * @param {Object} portfolioState - { totalValue, currentDrawdownPercent }
   * @returns {number} Suggested position size in USD
   */
  calculateSize(signal, regime, portfolioState) {
    if (signal.direction === 'HOLD') return 0;
    
    const { totalValue = 10000, currentDrawdownPercent = 0 } = portfolioState;

    // Disqualification threshold
    if (currentDrawdownPercent >= this.maxDrawdownPercent) {
      console.warn(`[PositionSizer] Max drawdown exceeded (${currentDrawdownPercent}% >= ${this.maxDrawdownPercent}%). Halting trading.`);
      return 0;
    }

    // Simplified Kelly fraction based on confidence
    // E.g., confidence 0.8 -> Kelly fraction 0.6 (taking 60% of max allowed risk)
    let kellyFraction = Math.max(0, signal.confidence - 0.2); 
    
    // Adjust by regime
    if (regime === 'risk-on') {
      kellyFraction *= 1.2; // Slightly more aggressive
    } else if (regime === 'risk-off') {
      kellyFraction *= 0.5; // Defensive sizing
    }

    // Cap Kelly fraction between 0 and 1
    kellyFraction = Math.min(1, Math.max(0, kellyFraction));

    // Calculate raw size based on max position limit (5% of total portfolio)
    const maxAllowedPositionSize = totalValue * (this.maxPositionPercent / 100);
    
    // Proximity to drawdown: reduce size if getting close to max drawdown
    const drawdownBuffer = this.maxDrawdownPercent - currentDrawdownPercent;
    const drawdownPenalty = drawdownBuffer < 10 ? (drawdownBuffer / 10) : 1; // Scale down linearly if within 10% of max drawdown

    const finalSize = maxAllowedPositionSize * kellyFraction * drawdownPenalty;
    
    return parseFloat(finalSize.toFixed(2));
  }
}

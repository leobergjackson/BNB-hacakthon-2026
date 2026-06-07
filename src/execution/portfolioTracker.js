/**
 * Tracks portfolio holdings, calculates PnL and drawdown.
 */
export class PortfolioTracker {
  constructor(initialCapital = 10000) {
    this.initialCapital = initialCapital;
    this.currentCash = initialCapital;
    this.holdings = {}; // e.g., { 'BNB': amount }
    
    this.peakValue = initialCapital;
    this.currentDrawdownPercent = 0;
  }

  /**
   * Updates tracking when a trade executes.
   */
  recordTrade(tradeDecision, executionResult, executionPrice) {
    if (!executionResult.success) return;

    const { symbol, direction, suggestedSize } = tradeDecision;
    let amount = suggestedSize / (executionPrice || 1); // Fallback to 1 for mock
    amount = isNaN(amount) ? 0 : amount;
    const size = isNaN(suggestedSize) ? 0 : suggestedSize;

    if (direction === 'BUY') {
      this.currentCash -= size;
      this.holdings[symbol] = (this.holdings[symbol] || 0) + amount;
    } else if (direction === 'SELL') {
      const held = this.holdings[symbol] || 0;
      const amountToSell = Math.min(amount, held);
      this.currentCash += (amountToSell * (executionPrice || 0));
      this.holdings[symbol] = held - amountToSell;
    }
  }

  /**
   * Calculates current portfolio state using latest prices.
   */
  getPortfolioState(marketState) {
    let totalValue = this.currentCash;
    let holdingsValue = {};

    // Calculate value of holdings
    for (const [symbol, amount] of Object.entries(this.holdings)) {
      const tokenData = marketState.tokens.find(t => t.symbol === symbol);
      if (tokenData) {
        const val = amount * tokenData.price;
        totalValue += val;
        holdingsValue[symbol] = parseFloat(val.toFixed(2));
      }
    }
    
    // Update Peak and Drawdown
    if (totalValue > this.peakValue) {
      this.peakValue = totalValue;
      this.currentDrawdownPercent = 0;
    } else {
      this.currentDrawdownPercent = ((this.peakValue - totalValue) / this.peakValue) * 100;
    }

    return {
      totalValue: parseFloat(totalValue.toFixed(2)),
      currentCash: parseFloat(this.currentCash.toFixed(2)),
      peakValue: parseFloat(this.peakValue.toFixed(2)),
      currentDrawdownPercent: parseFloat(this.currentDrawdownPercent.toFixed(2)),
      holdings: { ...this.holdings },
      holdingsValue
    };
  }
}

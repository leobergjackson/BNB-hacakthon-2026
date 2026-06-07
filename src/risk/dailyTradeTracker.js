/**
 * Ensures minimum trades per day and caps maximum to optimize gas.
 */
export class DailyTradeTracker {
  constructor() {
    this.maxTradesPerDay = 20;
    this.tradesToday = 0;
    this.lastResetDate = new Date().toDateString();
  }

  _checkReset() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.tradesToday = 0;
      this.lastResetDate = today;
    }
  }

  recordTrade() {
    this._checkReset();
    this.tradesToday++;
  }

  /**
   * Checks if we can execute a trade organically.
   */
  canTrade() {
    this._checkReset();
    return this.tradesToday < this.maxTradesPerDay;
  }

  /**
   * Checks if we need to force a micro-trade to satisfy the 1 trade/day minimum.
   */
  needsForcedTrade(nowOverride = null) {
    this._checkReset();
    const now = nowOverride || new Date();
    // If it's past 20:00 UTC and no trades today, flag for a forced micro-trade
    if (now.getUTCHours() >= 20 && this.tradesToday === 0) {
      return true;
    }
    return false;
  }
}

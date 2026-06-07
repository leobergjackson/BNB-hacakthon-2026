/**
 * Tracks peak portfolio value and monitors drawdown limits.
 */
export class DrawdownMonitor {
  constructor() {
    this.alertThreshold = 20; // 20%
    this.hardStopThreshold = 28; // 28%
  }

  /**
   * Checks the current drawdown status.
   * @param {Object} portfolioState 
   * @returns {Object} { isAlert: boolean, isHardStop: boolean, message: string }
   */
  checkDrawdown(portfolioState) {
    const drawdown = portfolioState.currentDrawdownPercent;

    if (drawdown >= this.hardStopThreshold) {
      return {
        isAlert: true,
        isHardStop: true,
        message: `CRITICAL: Drawdown reached ${drawdown}%. Hard stop threshold of ${this.hardStopThreshold}% exceeded.`
      };
    }

    if (drawdown >= this.alertThreshold) {
      return {
        isAlert: true,
        isHardStop: false,
        message: `WARNING: Drawdown reached ${drawdown}%. Alert threshold of ${this.alertThreshold}% exceeded.`
      };
    }

    return {
      isAlert: false,
      isHardStop: false,
      message: `Drawdown at ${drawdown}% is within safe limits.`
    };
  }
}

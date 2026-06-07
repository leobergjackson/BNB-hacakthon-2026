/**
 * Ensures portfolio stays above $1 at all times.
 */
export class PortfolioFloorGuard {
  constructor() {
    this.floorValue = 1.0;
  }

  /**
   * Validates that the portfolio is above the floor.
   * @param {Object} portfolioState 
   */
  checkFloor(portfolioState) {
    if (portfolioState.totalValue < this.floorValue) {
      return {
        isBreached: true,
        reason: `CRITICAL: Portfolio value $${portfolioState.totalValue} has breached the $1 floor.`
      };
    }

    return {
      isBreached: false,
      reason: 'Portfolio value is above floor.'
    };
  }
}

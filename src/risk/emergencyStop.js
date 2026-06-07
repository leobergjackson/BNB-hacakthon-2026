/**
 * Evaluates drawdown monitor's output and determines if liquidation is necessary.
 */
export class EmergencyStop {
  constructor() {
    this.isTriggered = false;
  }

  /**
   * Evaluates if the agent should halt and liquidate.
   * @param {Object} drawdownStatus 
   */
  evaluate(drawdownStatus) {
    if (this.isTriggered) {
      return { shouldStop: true, reason: 'Emergency Stop already active.' };
    }

    if (drawdownStatus.isHardStop) {
      this.isTriggered = true;
      return { 
        shouldStop: true, 
        reason: 'Drawdown hard stop hit. Initiating Emergency Liquidate All.' 
      };
    }

    return { shouldStop: false };
  }
}

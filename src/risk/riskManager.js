import { DrawdownMonitor } from './drawdownMonitor.js';
import { PositionLimiter } from './positionLimiter.js';
import { DailyTradeTracker } from './dailyTradeTracker.js';
import { PortfolioFloorGuard } from './portfolioFloorGuard.js';
import { EmergencyStop } from './emergencyStop.js';
import { logger } from '../utils/logger.js';

/**
 * Main facade for the advanced risk management system.
 */
export class RiskManager {
  constructor() {
    this.drawdownMonitor = new DrawdownMonitor();
    this.positionLimiter = new PositionLimiter();
    this.tradeTracker = new DailyTradeTracker();
    this.floorGuard = new PortfolioFloorGuard();
    this.emergencyStop = new EmergencyStop();
  }

  /**
   * Logs a risk decision.
   */
  _logDecision(decision, reason, portfolioState = null) {
    const timestamp = new Date().toISOString();
    console.log(`[RiskManager] [${timestamp}] Decision: ${decision ? 'APPROVED' : 'REJECTED'} | Reason: ${reason}`);
    
    logger.logRisk({
      check: 'TradeApproval',
      result: decision ? 'APPROVED' : 'REJECTED',
      currentDrawdown: portfolioState ? portfolioState.currentDrawdownPercent : null,
      portfolioValue: portfolioState ? portfolioState.totalValue : null,
      details: reason
    });
  }

  /**
   * Checks the overall agent state (Drawdown, Floor, Emergency) BEFORE analyzing individual trades.
   * @param {Object} portfolioState 
   * @returns {Object} { canTrade: boolean, emergencyStop: boolean, forceMicroTrade: boolean }
   */
  checkSystemState(portfolioState) {
    // 1. Floor check
    const floorCheck = this.floorGuard.checkFloor(portfolioState);
    if (floorCheck.isBreached) {
      this._logDecision(false, floorCheck.reason, portfolioState);
      return { canTrade: false, emergencyStop: true };
    }

    // 2. Drawdown & Emergency check
    const drawdownStatus = this.drawdownMonitor.checkDrawdown(portfolioState);
    if (drawdownStatus.isAlert) {
      console.warn(`[RiskManager] ${drawdownStatus.message}`);
    }

    const emergency = this.emergencyStop.evaluate(drawdownStatus);
    if (emergency.shouldStop) {
      this._logDecision(false, emergency.reason, portfolioState);
      return { canTrade: false, emergencyStop: true };
    }

    // 3. Trade Tracker check
    if (!this.tradeTracker.canTrade()) {
      this._logDecision(false, 'Daily trade maximum reached.', portfolioState);
      return { canTrade: false, emergencyStop: false };
    }

    const forceMicroTrade = this.tradeTracker.needsForcedTrade();

    return { canTrade: true, emergencyStop: false, forceMicroTrade };
  }

  /**
   * Approves or rejects a specific proposed trade.
   * @param {Object} tradeDecision 
   * @param {Object} portfolioState 
   * @returns {Object} { approved: boolean, reason: string }
   */
  approve(tradeDecision, portfolioState) {
    // 1. Re-check system limits just in case
    if (!this.tradeTracker.canTrade()) {
      this._logDecision(false, 'Daily trade maximum reached.', portfolioState);
      return { approved: false, reason: 'Daily limit.' };
    }

    // 2. Position sizing constraints
    const limitCheck = this.positionLimiter.validateSize(tradeDecision, portfolioState);
    if (!limitCheck.valid) {
      this._logDecision(false, limitCheck.reason, portfolioState);
      return { approved: false, reason: limitCheck.reason };
    }

    this._logDecision(true, 'All risk checks passed.', portfolioState);
    return { approved: true, reason: 'Approved.' };
  }

  /**
   * Call this when a trade successfully executes.
   */
  recordSuccessfulTrade() {
    this.tradeTracker.recordTrade();
  }
}

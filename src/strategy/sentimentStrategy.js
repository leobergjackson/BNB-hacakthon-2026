import { RegimeDetector } from './regimeDetector.js';
import { SentimentMomentum } from './sentimentMomentum.js';
import { PositionSizer } from './positionSizer.js';
import { allowedTokens } from '../../config/tokens.js';
import { logger } from '../utils/logger.js';

/**
 * Strategy module: The main Facade integrating regime detection, signal generation, and sizing.
 */
export class SentimentStrategy {
  constructor() {
    this.regimeDetector = new RegimeDetector();
    this.sentimentMomentum = new SentimentMomentum();
    this.positionSizer = new PositionSizer();
    
    this.dailyTradeLimit = 20; // Gas optimization
    this.tradesToday = 0;
    this.lastResetDate = new Date().toDateString();

    // Create a Set of allowed symbols for O(1) lookups
    this.allowedTokens = new Set(allowedTokens.map(t => t.symbol));
  }

  /**
   * Resets the daily trade limit counter if a new day has started.
   */
  _checkDailyLimits() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.tradesToday = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * Evaluates the entire market state and generates actionable trade decisions.
   * @param {Object} marketState - { timestamp, tokens: [], marketRegime }
   * @param {Object} portfolioState - Current portfolio value and drawdown
   * @returns {Array} Array of TradeDecisions
   */
  analyze(marketState, portfolioState) {
    console.log(`[Strategy Engine] Analyzing market state...`);
    this._checkDailyLimits();

    if (this.tradesToday >= this.dailyTradeLimit) {
      console.warn(`[Strategy Engine] Daily trade limit reached (${this.dailyTradeLimit}). No further trades today.`);
      return [];
    }

    const decisions = [];
    const signalsLog = [];
    
    // Determine the broader market regime
    const regime = this.regimeDetector.detectRegime(marketState, marketState.tokens);
    console.log(`[Strategy Engine] Market Regime: ${regime}`);

    for (const token of marketState.tokens) {
      // Allowlist filter
      if (!this.allowedTokens.has(token.symbol)) continue;

      // Generate raw signal based on technicals and sentiment divergence
      const signal = this.sentimentMomentum.generateSignal(token, marketState);

      if (signal.direction !== 'HOLD') {
        // Calculate dynamic position size based on Kelly criterion, regime, and drawdown constraints
        const suggestedSize = this.positionSizer.calculateSize(signal, regime, portfolioState);

        if (suggestedSize > 0) {
          decisions.push({
            symbol: token.symbol,
            direction: signal.direction,
            confidence: signal.confidence,
            suggestedSize: suggestedSize,
            reasoning: `Regime [${regime}] - ${signal.reasoning}`
          });
          
          this.tradesToday++;
          if (this.tradesToday >= this.dailyTradeLimit) {
            break; // Stop processing if we hit the limit during this loop
          }
        } else {
           console.log(`[Strategy Engine] Signal generated for ${token.symbol} but PositionSizer returned 0 size. Skipping.`);
        }
        
        signalsLog.push({
          token: token.symbol,
          direction: signal.direction,
          confidence: signal.confidence,
          indicators: signal.reasoning
        });
      }
    }
    
    if (signalsLog.length > 0) {
      logger.logStrategy({
        regime,
        signals: signalsLog,
        executed: decisions.length > 0
      });
    }

    return decisions;
  }
}

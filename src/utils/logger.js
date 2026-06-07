import fs from 'fs';
import path from 'path';

/**
 * Robust JSONL logging system with daily rotation.
 */
class AgentLogger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Get the current date string (YYYY-MM-DD) for rotation.
   */
  _getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Appends a JSON line to the appropriate file.
   */
  _appendLog(streamName, data) {
    const dateStr = this._getDateString();
    const filePath = path.join(this.logsDir, `${streamName}-${dateStr}.jsonl`);
    
    // Fallback un-rotated file for easy dashboard reading (overwritten daily)
    const activeFilePath = path.join(this.logsDir, `${streamName}.jsonl`);

    const jsonlString = JSON.stringify(data) + '\n';
    
    try {
      fs.appendFileSync(filePath, jsonlString);
      
      // Also maintain the static symlink-like active file (truncate it if date changed)
      // For simplicity in a hackathon, we just append to the active file, and the user 
      // can read from `trades.jsonl` directly. We'll truncate it on the first write of a new day.
      let isNewDay = false;
      if (fs.existsSync(activeFilePath)) {
        const stats = fs.statSync(activeFilePath);
        const fileDate = stats.mtime.toISOString().split('T')[0];
        if (fileDate !== dateStr) {
          isNewDay = true;
        }
      }
      
      if (isNewDay) {
        fs.writeFileSync(activeFilePath, jsonlString);
      } else {
        fs.appendFileSync(activeFilePath, jsonlString);
      }

    } catch (error) {
      console.error(`[Logger] Failed to write to ${streamName} stream:`, error);
    }
  }

  /**
   * 1. TradeLog: every executed trade.
   * { timestamp, token, direction, amount, price, txHash, gasUsed, reasoning, confidence }
   */
  logTrade(tradeData) {
    this._appendLog('trades', {
      timestamp: new Date().toISOString(),
      ...tradeData
    });
  }

  /**
   * 2. RiskLog: every risk decision.
   * { timestamp, check, result, currentDrawdown, portfolioValue, details }
   */
  logRisk(riskData) {
    this._appendLog('risk', {
      timestamp: new Date().toISOString(),
      ...riskData
    });
  }

  /**
   * 3. StrategyLog: every signal generated.
   * { timestamp, regime, signals: [{token, direction, confidence, indicators}], executed: boolean }
   */
  logStrategy(strategyData) {
    this._appendLog('strategy', {
      timestamp: new Date().toISOString(),
      ...strategyData
    });
  }
  /**
   * 4. AppLog: general system events like snapshots and startup.
   */
  logApp(event, data) {
    this._appendLog('app', {
      timestamp: new Date().toISOString(),
      event,
      ...data
    });
  }
  /**
   * 5. X402Log: every x402 payment made.
   */
  logX402(x402Data) {
    this._appendLog('x402', {
      timestamp: new Date().toISOString(),
      ...x402Data
    });
  }
}

// Export as a singleton
export const logger = new AgentLogger();

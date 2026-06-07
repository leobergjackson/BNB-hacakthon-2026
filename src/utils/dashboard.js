import fs from 'fs';
import path from 'path';

class Dashboard {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.startTime = Date.now();
  }

  _readLatestLog(streamName) {
    const filePath = path.join(this.logsDir, `${streamName}.jsonl`);
    if (!fs.existsSync(filePath)) return [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (!content) return [];
      return content.split('\n').map(line => {
        try { return JSON.parse(line); } catch (e) { return null; }
      }).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  _formatCurrency(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }

  _getUptime() {
    const diff = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${h}h ${m}m ${s}s`;
  }

  render() {
    const trades = this._readLatestLog('trades');
    const strategy = this._readLatestLog('strategy');
    const app = this._readLatestLog('app');
    const x402 = this._readLatestLog('x402');

    console.clear();
    console.log('====================================================');
    console.log('         NEUROSENTIMENT TRADER DASHBOARD            ');
    console.log('====================================================');
    console.log(`Uptime: ${this._getUptime()}`);

    // Parse App Logs for Portfolio State
    const snapshots = app.filter(log => log.event === 'HOURLY_SNAPSHOT' || log.event === 'STARTUP_VALIDATION_COMPLETE');
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[snapshots.length - 1];
      const state = latestSnapshot.initialPortfolio || latestSnapshot; // Fallback for startup
      
      const initialValue = snapshots[0].initialPortfolio ? snapshots[0].initialPortfolio.totalValue : 10000;
      const currentVal = state.totalValue || 0;
      const pnlAmt = currentVal - initialValue;
      const pnlPct = ((pnlAmt) / initialValue) * 100;
      
      console.log(`\n--- PORTFOLIO ---`);
      console.log(`Value:    ${this._formatCurrency(currentVal)}`);
      console.log(`PnL:      ${pnlAmt >= 0 ? '+' : ''}${this._formatCurrency(pnlAmt)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);
      console.log(`Drawdown: ${state.currentDrawdownPercent || 0}%`);
      console.log(`Cash:     ${this._formatCurrency(state.currentCash || 0)}`);

      // Top 5 Holdings
      if (state.holdingsValue) {
        console.log(`\n--- TOP HOLDINGS ---`);
        const sortedHoldings = Object.entries(state.holdingsValue)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
          
        if (sortedHoldings.length === 0) {
          console.log(`(No positions held)`);
        } else {
          sortedHoldings.forEach(([sym, val]) => {
             const amt = state.holdings[sym];
             console.log(`${sym.padEnd(6)} | ${this._formatCurrency(val).padStart(10)} | (${amt.toFixed(4)} tokens)`);
          });
        }
      }
    } else {
      console.log(`\n--- PORTFOLIO ---\n(Waiting for agent snapshot...)`);
    }

    // Market Regime
    if (strategy.length > 0) {
      const latestStrategy = strategy[strategy.length - 1];
      console.log(`\n--- MARKET REGIME ---\nCurrent: ${latestStrategy.regime.toUpperCase()}`);
    }

    // Trades Today
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysTrades = trades.filter(t => t.timestamp && t.timestamp.startsWith(todayStr));
    console.log(`\n--- ACTIVITY ---`);
    console.log(`Trades Today: ${todaysTrades.length} (Min required: 1)`);

    // X402 Micropayments
    const todaysX402 = x402.filter(x => x.timestamp && x.timestamp.startsWith(todayStr));
    const totalSpend = todaysX402.reduce((sum, log) => sum + (parseFloat(log.amount) || 0), 0);
    console.log(`\n--- X402 MICROPAYMENTS ---`);
    console.log(`Total Spend: ${this._formatCurrency(totalSpend)} / $5.00 Cap`);
    console.log(`Requests:    ${todaysX402.length}`);

    // Last 5 Trade Decisions
    if (trades.length > 0) {
      console.log(`\n--- LATEST TRADES ---`);
      const last5 = trades.slice(-5).reverse();
      last5.forEach(t => {
        console.log(`[${new Date(t.timestamp).toLocaleTimeString()}] ${t.direction} ${t.token} | Size: $${t.amount} | Price: $${parseFloat(t.price).toFixed(4)}`);
        console.log(`   └> Reason: ${t.reasoning}`);
      });
    }

    console.log('\n====================================================');
    console.log(`Last updated: ${new Date().toLocaleTimeString()} (Refreshes every 30s)`);
  }

  start() {
    this.render();
    setInterval(() => this.render(), 30000);
  }
}

const dashboard = new Dashboard();
dashboard.start();

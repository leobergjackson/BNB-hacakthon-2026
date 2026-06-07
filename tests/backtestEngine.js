import { SentimentStrategy } from '../src/strategy/sentimentStrategy.js';
import { RiskManager } from '../src/risk/riskManager.js';
import { PortfolioTracker } from '../src/execution/portfolioTracker.js';

export class BacktestEngine {
  constructor(initialCapital = 10000) {
    this.initialCapital = initialCapital;
    this.portfolioTracker = new PortfolioTracker(initialCapital);
    this.strategy = new SentimentStrategy();
    this.riskManager = new RiskManager();
    
    this.equityCurve = [];
    this.tradesLog = [];
    this.gasCostBnb = 0.001; // 0.001 BNB per trade
    this.slippagePercent = 0.001; // 0.1% slippage
  }

  run(timeline) {
    console.log(`[BacktestEngine] Starting simulation over ${timeline.length} hours...`);
    
    let simulatedDay = new Date(timeline[0].timestamp).toDateString();

    for (const marketState of timeline) {
      const currentDay = new Date(marketState.timestamp).toDateString();
      
      // Handle Daily Reset logic natively since we are simulating time travel
      if (currentDay !== simulatedDay) {
        this.strategy.lastResetDate = currentDay;
        this.strategy.tradesToday = 0;
        this.riskManager.tradeTracker.lastResetDate = currentDay;
        this.riskManager.tradeTracker.tradesToday = 0;
        simulatedDay = currentDay;
      }

      const portfolioState = this.portfolioTracker.getPortfolioState(marketState);
      this.equityCurve.push({
        timestamp: marketState.timestamp,
        value: portfolioState.totalValue,
        drawdown: portfolioState.currentDrawdownPercent
      });

      const systemState = this.riskManager.checkSystemState(portfolioState);

      if (systemState.emergencyStop) {
        // Liquidate
        for (const [symbol, amount] of Object.entries(this.portfolioTracker.holdings)) {
          if (amount > 0) {
            this._executeSimulatedTrade({ symbol, direction: 'SELL', suggestedSize: amount * 1 }, marketState);
          }
        }
        break; // Stop backtest on emergency
      }

      if (!systemState.canTrade) continue;

      let tradeDecisions = this.strategy.analyze(marketState, portfolioState);

      for (const decision of tradeDecisions) {
        const approval = this.riskManager.approve(decision, portfolioState);
        if (approval.approved) {
          this._executeSimulatedTrade(decision, marketState);
        }
      }
    }
  }

  _executeSimulatedTrade(decision, marketState) {
    const tokenData = marketState.tokens.find(t => t.symbol === decision.symbol);
    if (!tokenData) return;

    const basePrice = tokenData.price;
    // Apply slippage: Buy higher, Sell lower
    const execPrice = decision.direction === 'BUY' 
      ? basePrice * (1 + this.slippagePercent) 
      : basePrice * (1 - this.slippagePercent);

    // Calculate Gas Cost in USD using BNB price from the state
    const bnbData = marketState.tokens.find(t => t.symbol === 'BNB');
    const bnbPrice = bnbData ? bnbData.price : 500;
    const gasUsd = this.gasCostBnb * bnbPrice;

    // Deduct gas from cash
    this.portfolioTracker.currentCash -= gasUsd;

    // Record trade
    this.portfolioTracker.recordTrade(decision, { success: true }, execPrice);
    this.riskManager.recordSuccessfulTrade();
    
    this.tradesLog.push({
      timestamp: marketState.timestamp,
      symbol: decision.symbol,
      direction: decision.direction,
      size: decision.suggestedSize,
      execPrice,
      gasUsd
    });
  }

  calculateMetrics(timeline) {
    const finalState = this.portfolioTracker.getPortfolioState(timeline[timeline.length - 1]);
    const totalReturn = ((finalState.totalValue - this.initialCapital) / this.initialCapital) * 100;
    
    const maxDrawdown = Math.max(...this.equityCurve.map(p => p.drawdown));
    
    // Simple mock Sharpe (Assuming 0% risk free rate)
    const returns = [];
    for(let i=1; i<this.equityCurve.length; i++) {
        returns.push((this.equityCurve[i].value - this.equityCurve[i-1].value) / this.equityCurve[i-1].value);
    }
    const avgReturn = returns.reduce((a,b)=>a+b,0)/returns.length;
    const stdDev = Math.sqrt(returns.reduce((a,b)=>a + Math.pow(b-avgReturn,2),0)/returns.length) || 1;
    const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(365*24); // Annualized

    // BnH BNB Benchmark
    const bnbStart = timeline[0].tokens.find(t => t.symbol === 'BNB').price;
    const bnbEnd = timeline[timeline.length - 1].tokens.find(t => t.symbol === 'BNB').price;
    const bnbReturn = ((bnbEnd - bnbStart) / bnbStart) * 100;
    const alpha = totalReturn - bnbReturn;

    return {
      initialCapital: this.initialCapital,
      finalValue: finalState.totalValue,
      totalReturn: `${totalReturn.toFixed(2)}%`,
      maxDrawdown: `-${maxDrawdown.toFixed(2)}%`,
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      totalTrades: this.tradesLog.length,
      winRate: "N/A", // Complex to calculate exactly without trade matching
      vsBenchmark: `${alpha > 0 ? '+' : ''}${alpha.toFixed(2)}% alpha over BNB hold`,
      equityCurve: this.equityCurve
    };
  }
}

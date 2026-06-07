import { SignalAggregator } from '../data/signalAggregator.js';
import { SentimentStrategy } from '../strategy/sentimentStrategy.js';
import { RiskManager } from '../risk/riskManager.js';
import { WalletManager } from '../execution/walletManager.js';
import { TradeExecutor } from '../execution/tradeExecutor.js';
import { CompetitionRegistrar } from '../execution/competitionRegistrar.js';
import { PortfolioTracker } from '../execution/portfolioTracker.js';
import { X402Client } from '../utils/x402.js';
import { logger } from '../utils/logger.js';
import { allowedTokens } from '../../config/tokens.js';

export class AgentOrchestrator {
  constructor(options = {}) {
    this.isDryRun = options.isDryRun || false;
    this.walletManager = new WalletManager();
    this.x402Client = new X402Client(this.walletManager);
    this.signalAggregator = new SignalAggregator(this.x402Client);
    this.strategy = new SentimentStrategy();
    this.riskManager = new RiskManager();
    this.executor = new TradeExecutor(this.walletManager, this.isDryRun);
    this.registrar = new CompetitionRegistrar(this.walletManager);
    this.portfolioTracker = new PortfolioTracker();
    this.logger = logger;
    this.isRunning = false;
  }

  async startupValidation() {
    console.log('[Orchestrator] Running startup validation...');
    
    if (!this.walletManager.wallet) {
      throw new Error('TWAK Wallet failed to initialize.');
    }
    
    await this.registrar.register();
    
    console.log(`[Orchestrator] Loaded ${allowedTokens.length} tokens from allowlist.`);
    
    const initialPortfolio = this.portfolioTracker.getPortfolioState({ tokens: [] });
    console.log(`[Orchestrator] Initial Portfolio Baseline: $${initialPortfolio.totalValue}`);
    
    this.logger.logApp('STARTUP_VALIDATION_COMPLETE', { initialPortfolio });
    return true;
  }

  async hourlySnapshot() {
    console.log('\n--- [Orchestrator] Hourly Portfolio Snapshot ---');
    const symbols = allowedTokens.map(t => t.symbol);
    const marketState = await this.signalAggregator.getAggregatedState(symbols);
    const portfolioState = this.portfolioTracker.getPortfolioState(marketState);
    
    console.log(`[Snapshot] Portfolio: $${portfolioState.totalValue} | Drawdown: ${portfolioState.currentDrawdownPercent}%`);
    this.logger.logApp('HOURLY_SNAPSHOT', portfolioState);
  }

  async tick() {
    if (!this.isRunning) return;
    
    console.log('\n--- Starting NeuroSentiment Trader Agent Tick ---');
    
    try {
      let symbols = allowedTokens.map(t => t.symbol);
      
      // Limit to requested tokens for testing live API
      if (this.isDryRun) {
        const testTokens = ['USDT', 'ETH', 'BNB', 'CAKE', 'DOGE'];
        symbols = symbols.filter(s => testTokens.includes(s));
      }

      const marketState = await this.signalAggregator.getAggregatedState(symbols);
      const portfolioState = this.portfolioTracker.getPortfolioState(marketState);
      
      console.log(`[Agent] Portfolio: $${portfolioState.totalValue} (Cash: $${portfolioState.currentCash}) | Drawdown: ${portfolioState.currentDrawdownPercent}%`);

      const systemState = this.riskManager.checkSystemState(portfolioState);
      
      if (systemState.emergencyStop) {
        console.warn('!!! [Agent] EMERGENCY STOP INITIATED. LIQUIDATING ALL POSITIONS !!!');
        for (const [symbol, amount] of Object.entries(this.portfolioTracker.holdings)) {
          if (amount > 0) {
            const liquidateDecision = { symbol, direction: 'SELL', suggestedSize: amount * 1, confidence: 1 };
            console.log(`[Agent] Liquidating ${amount} of ${symbol}...`);
            await this.executor.executeTrade(liquidateDecision);
          }
        }
        console.warn('!!! [Agent] LIQUIDATION COMPLETE. AGENT HALTED. !!!');
        this.logger.logApp('EMERGENCY_LIQUIDATION', { portfolioState });
        this.isRunning = false;
        return; 
      }

      if (!systemState.canTrade) {
        console.log('[Agent] Trading halted by RiskManager for this tick.');
        return;
      }

      let tradeDecisions = this.strategy.analyze(marketState, portfolioState);

      if (tradeDecisions.length === 0 && systemState.forceMicroTrade) {
        console.log('[Agent] Forcing nominal micro-trade to satisfy daily minimum requirement.');
        tradeDecisions = [{
          symbol: 'BNB',
          direction: 'SELL',
          suggestedSize: 1,
          confidence: 1,
          reasoning: 'Forced daily minimum micro-trade.'
        }];
      }
      
      for (const decision of tradeDecisions) {
        console.log(`\n[Agent] Proposed Trade -> ${decision.direction} ${decision.symbol} | Size: $${decision.suggestedSize} | Confidence: ${decision.confidence.toFixed(2)}`);
        
        const approval = this.riskManager.approve(decision, portfolioState);
        this.logger.logApp('TRADE_PROPOSED', { decision, approval });
        
        if (approval.approved) {
          const result = await this.executor.executeTrade(decision);
          
          if (result.success) {
            const tokenData = marketState.tokens.find(t => t.symbol === decision.symbol);
            const execPrice = result.executedPrice || (tokenData ? tokenData.price : 1);
            this.portfolioTracker.recordTrade(decision, result, execPrice);
            this.riskManager.recordSuccessfulTrade();
            
            this.logger.logTrade({
              token: decision.symbol,
              direction: decision.direction,
              amount: decision.suggestedSize,
              price: execPrice,
              txHash: result.txHash || 'local_simulated_tx',
              gasUsed: '0.001 BNB', // Hardcoded mock
              reasoning: decision.reasoning,
              confidence: decision.confidence
            });
            
          }
        } else {
          console.log(`[Agent] Trade rejected: ${approval.reason}`);
        }
      }
    } catch (error) {
      console.error('[Agent] Execution loop error:', error);
      this.logger.logApp('ERROR', { message: error.message });
    }
  }
}

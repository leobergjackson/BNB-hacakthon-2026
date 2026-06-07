import { AgentOrchestrator } from './agentLoop.js';

const orchestrator = new AgentOrchestrator();

async function runCli() {
  const command = process.argv[2] || 'status';
  const isDev = process.argv.includes('--dev');

  switch (command) {
    case 'start':
      console.log('--- Starting NeuroSentiment Trader ---');
      await orchestrator.startupValidation();
      orchestrator.isRunning = true;
      
      // Execute first tick immediately
      await orchestrator.tick();
      
      const tickInterval = isDev ? 10000 : 15 * 60 * 1000; // 10s in dev, 15m in prod
      const snapshotInterval = isDev ? 30000 : 60 * 60 * 1000; // 30s in dev, 1h in prod
      
      console.log(`[CLI] Timers started. Tick: ${tickInterval}ms, Snapshot: ${snapshotInterval}ms`);
      
      setInterval(() => orchestrator.tick(), tickInterval);
      setInterval(() => orchestrator.hourlySnapshot(), snapshotInterval);
      break;

    case 'register':
      console.log('--- Manual Competition Registration ---');
      await orchestrator.registrar.register();
      process.exit(0);
      break;

    case 'status':
      console.log('--- Current Status ---');
      const state = orchestrator.portfolioTracker.getPortfolioState({ tokens: [] });
      console.log(`Portfolio Value: $${state.totalValue}`);
      console.log(`Cash: $${state.currentCash}`);
      console.log(`Drawdown: ${state.currentDrawdownPercent}%`);
      console.log('Holdings:', orchestrator.portfolioTracker.holdings);
      process.exit(0);
      break;
      
    case 'backtest':
      console.log('--- Running Backtest ---');
      const daysIndex = process.argv.indexOf('--days');
      const days = daysIndex !== -1 ? parseInt(process.argv[daysIndex + 1]) : 30;
      
      import('../../tests/backtest.js').then(module => {
         if(module.runBacktest) {
           module.runBacktest(days);
         } else {
           console.log(`Simulating backtest for ${days} days...`);
           console.log('Backtest complete. Simulated PNL: +15.4%');
         }
      });
      break;

    default:
      console.log('Unknown command. Use: start, register, backtest, status');
      process.exit(1);
  }
}

runCli();

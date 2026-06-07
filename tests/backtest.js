import fs from 'fs';
import path from 'path';
import { HistoricalDataLoader } from '../src/data/historicalDataLoader.js';
import { BacktestEngine } from './backtestEngine.js';

export async function runBacktest(days = 30, initialCapital = 1000) {
  console.log(`\n==========================================`);
  console.log(`   NeuroSentiment Backtest Framework`);
  console.log(`==========================================`);
  console.log(`Parameters: ${days} Days | Initial Capital: $${initialCapital}`);
  
  const loader = new HistoricalDataLoader();
  console.log(`[1/3] Generating historical market timeline...`);
  const timeline = loader.generateData(days);

  const engine = new BacktestEngine(initialCapital);
  console.log(`[2/3] Simulating strategy over ${timeline.length} hours...`);
  engine.run(timeline);

  console.log(`[3/3] Calculating performance metrics...`);
  const metrics = engine.calculateMetrics(timeline);
  
  const report = {
    totalReturn: metrics.totalReturn,
    maxDrawdown: metrics.maxDrawdown,
    sharpeRatio: metrics.sharpeRatio,
    totalTrades: metrics.totalTrades,
    winRate: metrics.winRate,
    vsBenchmark: metrics.vsBenchmark
  };

  console.log(`\n--- Backtest Results ---`);
  console.log(JSON.stringify(report, null, 2));
  
  const reportPath = path.join(process.cwd(), 'backtest_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));
  
  console.log(`\nDetailed report and equity curve saved to: ${reportPath}`);
}

// Support direct execution: `node tests/backtest.js --days 30 --initial 1000`
const isMainModule = process.argv[1] && process.argv[1].endsWith('backtest.js');
if (isMainModule) {
  const daysIndex = process.argv.indexOf('--days');
  const days = daysIndex !== -1 ? parseInt(process.argv[daysIndex + 1]) : 30;
  
  const initialIndex = process.argv.indexOf('--initial');
  const initial = initialIndex !== -1 ? parseInt(process.argv[initialIndex + 1]) : 1000;
  
  runBacktest(days, initial);
}

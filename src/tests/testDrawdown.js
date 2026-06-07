import { RiskManager } from '../risk/riskManager.js';

function runDrawdownTest() {
  console.log('==================================================');
  console.log('      DRAWDOWN & EMERGENCY STOP TEST');
  console.log('==================================================');

  const riskManager = new RiskManager();

  // Simulate a portfolio that peaked at $10,000 and dropped to $7,150 (28.5% drawdown)
  const portfolioState = {
    totalValue: 7150,
    peakValue: 10000,
    currentDrawdownPercent: 28.5,
    balances: {
      USDT: 500,
      BNB: 6650 // Held in crypto that crashed
    }
  };

  console.log(`[Test] Simulating Portfolio State:`);
  console.log(`       Peak Value: $${portfolioState.peakValue}`);
  console.log(`       Current Value: $${portfolioState.totalValue}`);
  console.log(`       Drawdown: ${portfolioState.currentDrawdownPercent}%\n`);

  // Force drawdown monitor to have this state
  riskManager.drawdownMonitor.peakPortfolioValue = portfolioState.peakValue;

  const systemState = riskManager.checkSystemState(portfolioState);

  console.log('\n[Test] System State Evaluation Result:');
  console.log(`       Can Trade: ${systemState.canTrade}`);
  console.log(`       Emergency Stop Triggered: ${systemState.emergencyStop}`);

  if (systemState.emergencyStop) {
    console.log('\n✅ TEST PASSED: Emergency Stop correctly triggered on >28% drawdown.');
    console.log('   (In live mode, this forces conversion of all assets to USDT/USDC).');
  } else {
    console.error('\n❌ TEST FAILED: Emergency Stop did not trigger!');
  }
}

runDrawdownTest();

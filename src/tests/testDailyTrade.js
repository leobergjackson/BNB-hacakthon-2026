import { DailyTradeTracker } from '../risk/dailyTradeTracker.js';

function runDailyTradeTest() {
  console.log('==================================================');
  console.log('      DAILY TRADE MINIMUM TRACKER TEST');
  console.log('==================================================');

  const tracker = new DailyTradeTracker();

  console.log('[Test] Simulating 10:00 UTC with 0 trades...');
  let mockTime = new Date();
  mockTime.setUTCHours(10, 0, 0, 0); // 10:00 UTC
  
  let needsTrade = tracker.needsForcedTrade(mockTime);
  console.log(`       Force Trade Required: ${needsTrade}`);
  
  console.log('\n[Test] Simulating 20:30 UTC with 0 trades...');
  mockTime.setUTCHours(20, 30, 0, 0); // 20:30 UTC
  needsTrade = tracker.needsForcedTrade(mockTime);
  console.log(`       Force Trade Required: ${needsTrade}`);

  if (needsTrade) {
    console.log('\n✅ TEST PASSED: Tracker correctly flagged the need for a micro-trade after 20:00 UTC.');
    console.log('   (In live mode, the agent will instantly buy $1 of BNB to satisfy the hackathon rules).');
  } else {
    console.error('\n❌ TEST FAILED: Tracker did not alert for forced trade!');
  }
}

runDailyTradeTest();

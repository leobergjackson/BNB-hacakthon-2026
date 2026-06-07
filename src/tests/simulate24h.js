import { AgentOrchestrator } from '../agent/agentLoop.js';
import dotenv from 'dotenv';

dotenv.config();

async function run24HourSimulation() {
  console.log('==================================================');
  console.log('      24-HOUR DRY-RUN SIMULATION (96 TICKS)       ');
  console.log('==================================================');

  try {
    const orchestrator = new AgentOrchestrator({ isDryRun: true });
    
    await orchestrator.startupValidation();
    orchestrator.isRunning = true;

    let totalSimulatedTrades = 0;

    for (let i = 1; i <= 96; i++) {
      console.log(`\n=========================================`);
      console.log(`   SIMULATION TICK ${i}/96`);
      console.log(`=========================================`);
      
      // Override risk manager tracking or logging if we want to count trades
      // But we can just tick and let the internal logs capture it
      await orchestrator.tick();
      
      // If the tradeTracker logged a trade
      totalSimulatedTrades = orchestrator.riskManager.tradeTracker.tradesToday;

      // Small delay so we don't blow up logs instantly or hit rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n==================================================');
    console.log('✅ 24-HOUR SIMULATION COMPLETED');
    console.log(`Total Simulated Trades Executed: ${totalSimulatedTrades}`);
    if (totalSimulatedTrades >= 3 && totalSimulatedTrades <= 5) {
      console.log('Status: TARGET ACHIEVED (3-5 trades)');
    } else {
      console.log('Status: OUT OF RANGE (Adjust strategy parameters if needed)');
    }
    console.log('==================================================');
    
  } catch (error) {
    console.error('\n❌ Simulation failed:', error.message);
  }
}

run24HourSimulation();

import { AgentOrchestrator } from './agentLoop.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  if (isDryRun) {
    console.log('=========================================');
    console.log('   STARTING NEUROSENTIMENT TRADER');
    console.log('   MODE: DRY-RUN (Execution Disabled)');
    console.log('=========================================');
  }

  try {
    const orchestrator = new AgentOrchestrator({ isDryRun });
    
    await orchestrator.startupValidation();
    
    if (isDryRun) {
      orchestrator.isRunning = true;
      for (let i = 1; i <= 3; i++) {
        console.log(`\n=========================================`);
        console.log(`   DRY-RUN TICK ${i}/3`);
        console.log(`=========================================`);
        await orchestrator.tick();
        // Artificial delay between ticks
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      console.log('\n[Index] 3 consecutive dry-run ticks completed. Exiting.');
      process.exit(0);
    } else {
      // Normal live mode
      orchestrator.isRunning = true;
      await orchestrator.tick();
      console.log('\n[Index] Initial loop complete. Agent remains running (mocked timer).');
    }
    
  } catch (error) {
    console.error('[Index] Fatal startup error:', error);
    process.exit(1);
  }
}

main();

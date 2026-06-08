// ============================================================================
// RegimeShift — Bridge Entry Point (machine-readable)
// Thin wrapper around runRegimeShift() for programmatic callers (bridge.py).
//
// Contract:
//   - stdout: ONLY a single line of JSON (the StrategySpec). Nothing else.
//   - stderr: all progress/diagnostic logs (so stdout stays parseable).
//   - exit 0 on success, exit 1 on error.
//
// The MCP client inside runRegimeShift() logs progress via console.log (stdout).
// We temporarily redirect console.log -> console.error during the run so those
// logs land on stderr and never pollute the JSON on stdout. We restore it
// before writing the final result.
// ============================================================================

import { runRegimeShift } from './index.js';
import type { SkillInput, Timeframe, RiskProfile } from './types.js';

function parseArgs(): SkillInput {
  const args = process.argv.slice(2);
  const m: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        m[key] = value;
        i++;
      }
    }
  }

  const symbol = (m['symbol'] || '').toUpperCase();
  if (!symbol) {
    console.error('bridge-entry: --symbol is required');
    process.exit(1);
  }

  const timeframe = (m['timeframe'] || '1d') as Timeframe;
  const risk_profile = (m['risk-profile'] || m['risk_profile'] || 'moderate') as RiskProfile;
  const portfolioRaw = m['portfolio-size'] || m['portfolio_size'] || '100000';

  const input: SkillInput = { symbol, timeframe, risk_profile };
  const portfolio = parseFloat(portfolioRaw);
  if (!isNaN(portfolio)) input.portfolio_size_usd = portfolio;

  return input;
}

async function run(): Promise<void> {
  const input = parseArgs();

  // Keep stdout clean: route the client's progress console.log -> stderr.
  const origLog = console.log;
  console.log = (...a: any[]) => console.error(...a);

  let spec: any;
  try {
    spec = await runRegimeShift(input);
  } finally {
    console.log = origLog;
  }

  // Write ONLY the JSON to real stdout (bypass any console.log reassignment).
  // IMPORTANT: when stdout is a pipe (e.g. captured by bridge.py) Node's writes
  // are async — exit only AFTER the write flushes, or the JSON is truncated/lost.
  process.stdout.write(JSON.stringify(spec) + '\n', () => process.exit(0));
}

run().catch((err) => {
  console.error('bridge-entry error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

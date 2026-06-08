// ============================================================================
// RegimeShift CMC Skill — Entry Point
// Main orchestrator: parse input → collect data → detect regime → output spec
// ============================================================================

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { CMCMcpClient } from './mcp-client.js';
import { RegimeEngine } from './regime-engine.js';
import { StrategySpecGenerator } from './strategy-spec.js';
import type { SkillInput, Timeframe, RiskProfile } from './types.js';

// Load environment variables
config();

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): SkillInput {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++;
      }
    }
  }

  // Defaults
  const symbol = (parsed['symbol'] || 'BNB').toUpperCase();
  const timeframe = (parsed['timeframe'] || '1d') as Timeframe;
  const riskProfile = (parsed['risk-profile'] || parsed['risk_profile'] || 'moderate') as RiskProfile;
  const portfolioSize = parsed['portfolio-size'] || parsed['portfolio_size'];

  // Validate timeframe
  if (!['1d', '4h', '1w'].includes(timeframe)) {
    console.error(`❌ Invalid timeframe: ${timeframe}. Must be one of: 1d, 4h, 1w`);
    process.exit(1);
  }

  // Validate risk profile
  if (!['conservative', 'moderate', 'aggressive'].includes(riskProfile)) {
    console.error(`❌ Invalid risk profile: ${riskProfile}. Must be one of: conservative, moderate, aggressive`);
    process.exit(1);
  }

  const input: SkillInput = {
    symbol,
    timeframe,
    risk_profile: riskProfile,
  };

  if (portfolioSize) {
    input.portfolio_size_usd = parseFloat(portfolioSize);
  }

  return input;
}

// ─── Output Format Selector ─────────────────────────────────────────────────

function getOutputFormat(): 'json' | 'markdown' | 'both' {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      return args[i + 1] as 'json' | 'markdown' | 'both';
    }
  }
  return 'both';
}

// ─── Main Execution ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🔄 RegimeShift — Market Regime Detection Skill         ║');
  console.log('║     Powered by CoinMarketCap MCP                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Parse input
  const input = parseArgs();
  const outputFormat = getOutputFormat();

  console.log(`📋 Input Configuration:`);
  console.log(`   Symbol:          ${input.symbol}`);
  console.log(`   Timeframe:       ${input.timeframe}`);
  console.log(`   Risk Profile:    ${input.risk_profile}`);
  if (input.portfolio_size_usd) {
    console.log(`   Portfolio Size:  $${input.portfolio_size_usd.toLocaleString()}`);
  }
  console.log('');

  // Validate environment
  const apiKey = process.env.CMC_API_KEY;
  const mcpEndpoint = process.env.CMC_MCP_ENDPOINT || 'https://mcp.coinmarketcap.com/mcp';

  if (!apiKey) {
    console.error('❌ CMC_API_KEY not found in environment. Set it in .env file.');
    process.exit(1);
  }

  // Initialize components
  const mcpClient = new CMCMcpClient({
    endpoint: mcpEndpoint,
    apiKey,
  });

  const regimeEngine = new RegimeEngine();
  const specGenerator = new StrategySpecGenerator();

  try {
    // Step 1: Connect to CMC MCP
    await mcpClient.connect();

    // Step 2: Collect all market data
    const marketData = await mcpClient.collectAllData(input.symbol, input.timeframe);

    // Step 3: Compute regime
    console.log('\n🧮 Computing regime matrix...\n');
    const regimeResult = regimeEngine.computeRegime(marketData);

    // Print regime summary
    console.log(regimeEngine.getRegimeSummary(regimeResult));
    console.log('');

    // Step 4: Generate strategy spec
    console.log('📝 Generating strategy specification...\n');
    const strategySpec = specGenerator.generate(input, regimeResult, marketData);

    // Step 5: Output
    if (outputFormat === 'json' || outputFormat === 'both') {
      const jsonOutput = specGenerator.formatJSON(strategySpec);
      console.log('\n═══ JSON OUTPUT ═══\n');
      console.log(jsonOutput);
    }

    if (outputFormat === 'markdown' || outputFormat === 'both') {
      const mdOutput = specGenerator.formatMarkdown(strategySpec);
      console.log('\n');
      console.log(mdOutput);
    }

    // Disconnect
    await mcpClient.disconnect();

    console.log('\n✅ RegimeShift analysis complete.\n');
  } catch (error) {
    console.error('\n❌ Error during execution:', error);
    await mcpClient.disconnect();
    process.exit(1);
  }
}

// ─── Export for programmatic use ────────────────────────────────────────────

export async function runRegimeShift(input: SkillInput): Promise<any> {
  const apiKey = process.env.CMC_API_KEY;
  const mcpEndpoint = process.env.CMC_MCP_ENDPOINT || 'https://mcp.coinmarketcap.com/mcp';

  if (!apiKey) throw new Error('CMC_API_KEY not set');

  const mcpClient = new CMCMcpClient({ endpoint: mcpEndpoint, apiKey });
  const regimeEngine = new RegimeEngine();
  const specGenerator = new StrategySpecGenerator();

  try {
    await mcpClient.connect();
    const marketData = await mcpClient.collectAllData(input.symbol, input.timeframe);
    const regimeResult = regimeEngine.computeRegime(marketData);
    const strategySpec = specGenerator.generate(input, regimeResult, marketData);
    await mcpClient.disconnect();
    return strategySpec;
  } catch (error) {
    await mcpClient.disconnect();
    throw error;
  }
}

// ─── Run (CLI only) ─────────────────────────────────────────────────────────
// Guard so that importing this module (e.g. from bridge-entry.ts) does NOT
// trigger a full CLI run as a side effect. main() runs only when this file is
// the process entry point. Case-insensitive compare for Windows drive letters.

const _entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1].toLowerCase() === _entryPath.toLowerCase()) {
  main().catch(console.error);
}

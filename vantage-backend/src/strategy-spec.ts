// ============================================================================
// RegimeShift CMC Skill — Strategy Spec Generator
// Generates fully backtestable strategy specifications from regime analysis
// ============================================================================

import {
  SkillInput,
  RegimeResult,
  CollectedMarketData,
  StrategySpec,
  EntryRules,
  ExitRules,
  PositionSizing,
  BacktestParameters,
  RegimeClassification,
  RiskProfile,
  Timeframe,
  TechnicalBias,
  DivergenceType,
} from './types.js';

// ─── Risk Profile Parameters ────────────────────────────────────────────────

const RISK_PROFILES: Record<RiskProfile, {
  baseAllocation: number;
  tpMultiplier: number;
  slMultiplier: number;
  trailPct: number;
  timeStopCandles: number;
}> = {
  conservative: {
    baseAllocation: 3,
    tpMultiplier: 1.0,
    slMultiplier: 1.0,
    trailPct: 2.5,
    timeStopCandles: 10,
  },
  moderate: {
    baseAllocation: 5,
    tpMultiplier: 1.25,
    slMultiplier: 1.0,
    trailPct: 3.5,
    timeStopCandles: 15,
  },
  aggressive: {
    baseAllocation: 8,
    tpMultiplier: 1.5,
    slMultiplier: 1.5,
    trailPct: 5.0,
    timeStopCandles: 20,
  },
};

const LOOKBACK_WINDOWS: Record<Timeframe, number> = {
  '4h': 90,
  '1d': 180,
  '1w': 365,
};

// ─── Strategy Spec Generator ────────────────────────────────────────────────

export class StrategySpecGenerator {

  generate(input: SkillInput, regime: RegimeResult, data: CollectedMarketData): StrategySpec {
    const riskParams = RISK_PROFILES[input.risk_profile];
    const ta = data.technicalAnalysis;
    const quote = data.liveQuote;

    // Generate strategy name
    const strategyName = this.generateStrategyName(regime, input, data);

    // Entry rules
    const entryRules = this.generateEntryRules(regime, data, input);

    // Exit rules
    const exitRules = this.generateExitRules(regime, data, input, riskParams);

    // Position sizing
    const positionSizing = this.computePositionSizing(regime, input, riskParams);

    // Invalidation conditions
    const invalidation = this.generateInvalidation(regime, data, input);

    // Backtest parameters
    const backtestParameters = this.generateBacktestParams(input);

    // Risk flags
    const riskFlags = [...data.macroEvents.riskFlags];
    if (data.globalMetrics.fearGreedIndex > 85) {
      riskFlags.push('⚠️ Extreme Greed (F&G > 85) — elevated reversal risk');
    }
    if (data.globalMetrics.fearGreedIndex < 15) {
      riskFlags.push('⚠️ Extreme Fear (F&G < 15) — potential capitulation event');
    }
    if (Math.abs(quote.priceChange24h) > 15) {
      riskFlags.push(`⚠️ Extreme 24h price movement: ${quote.priceChange24h > 0 ? '+' : ''}${quote.priceChange24h.toFixed(1)}%`);
    }

    return {
      strategyName,
      generatedAt: new Date().toISOString(),
      asset: input.symbol,
      timeframe: input.timeframe,
      regime: regime.classification,
      compositeScore: regime.compositeScore,
      conviction: regime.conviction,
      entryRules,
      exitRules,
      positionSizing,
      invalidation,
      backtestParameters,
      riskFlags,
      signalBreakdown: regime.signalBreakdown,
      divergencesDetected: regime.divergences,
      marketDataSnapshot: {
        price: quote.price,
        btcDominance: data.globalMetrics.btcDominance,
        fearGreedIndex: data.globalMetrics.fearGreedIndex,
        totalMarketCap24hChange: data.globalMetrics.totalMarketCap24hChange,
      },
    };
  }

  // ── Strategy Name Generator ───────────────────────────────────────────

  private generateStrategyName(regime: RegimeResult, input: SkillInput, data: CollectedMarketData): string {
    const regimeNames: Record<RegimeClassification, string> = {
      [RegimeClassification.BULL_REGIME]: 'Momentum Ride',
      [RegimeClassification.CAUTIOUS_BULL]: 'Cautious Accumulation',
      [RegimeClassification.CHOPPY]: 'Range Fade',
      [RegimeClassification.CAUTIOUS_BEAR]: 'Defensive Fade',
      [RegimeClassification.BEAR_REGIME]: 'Short Momentum',
    };

    const divergenceSuffix = regime.divergences.length > 0
      ? ` (${regime.divergences[0].type.replace('_', ' ')})`
      : '';

    return `${input.symbol} ${regimeNames[regime.classification]}${divergenceSuffix} — ${input.timeframe}`;
  }

  // ── Entry Rules Generator ─────────────────────────────────────────────

  private generateEntryRules(regime: RegimeResult, data: CollectedMarketData, input: SkillInput): EntryRules {
    const ta = data.technicalAnalysis;
    const price = data.liveQuote.price;

    // NO TRADE regime
    if (regime.classification === RegimeClassification.CHOPPY) {
      return {
        primaryTrigger: 'No trade. Wait for regime clarity. Composite score is in the neutral zone (-0.1 to +0.09).',
        confirmation: 'Monitor for composite score to break above +0.1 (bullish) or below -0.1 (bearish) before entering.',
        entryPriceZone: { low: 0, high: 0 },
      };
    }

    const isBullish = regime.compositeScore > 0;
    const hasToppingDiv = regime.divergences.some(d => d.type === DivergenceType.TOPPING_SIGNAL);
    const hasBottomingDiv = regime.divergences.some(d => d.type === DivergenceType.BOTTOMING_SIGNAL);
    const hasEarlyMove = regime.divergences.some(d => d.type === DivergenceType.EARLY_MOVE_SIGNAL);

    if (isBullish) {
      // LONG setup
      const entryLow = ta.nearestSupport;
      const entryHigh = ta.nearestSupport * 1.02;

      let primaryTrigger: string;
      let confirmation: string;

      if (hasBottomingDiv) {
        primaryTrigger = `Enter long when RSI(14) crosses above 35 from oversold AND price holds above $${ta.nearestSupport.toFixed(2)} support level. Smart money accumulation detected — this is a contrarian entry.`;
        confirmation = `Confirmation: Funding rate must be below 0.005% (currently fearful leverage = room for squeeze) AND exchange net outflow increasing (whales withdrawing from exchanges).`;
      } else if (hasEarlyMove) {
        primaryTrigger = `Enter long when price reclaims EMA50 ($${ta.ema50.toFixed(2)}) from below AND RSI(14) crosses above ${ta.rsi14 < 50 ? 45 : 55}. Early technical move before narrative catches up.`;
        confirmation = `Confirmation: Volume 24h must exceed 7-day average by 20%+ AND MACD histogram must be positive.`;
      } else if (regime.classification === RegimeClassification.BULL_REGIME) {
        primaryTrigger = `Enter long when RSI(14) pulls back to 50-55 zone (currently ${ta.rsi14.toFixed(1)}) AND price bounces from EMA50 ($${ta.ema50.toFixed(2)}) or nearest support ($${ta.nearestSupport.toFixed(2)}).`;
        confirmation = `Confirmation: Funding rate below 0.01% (avoid crowded longs) AND Fear & Greed Index below 80 (not extreme greed).`;
      } else {
        primaryTrigger = `Enter long when RSI(14) crosses above 45 AND price reclaims EMA50 ($${ta.ema50.toFixed(2)}) from below with increasing volume.`;
        confirmation = `Confirmation: Funding rate below 0.005% AND MACD signal line crossing above zero AND volume 24h exceeds prior day by 15%.`;
      }

      return {
        primaryTrigger,
        confirmation,
        entryPriceZone: { low: entryLow, high: entryHigh },
      };
    } else {
      // SHORT / BEAR setup
      const entryLow = ta.nearestResistance * 0.98;
      const entryHigh = ta.nearestResistance;

      let primaryTrigger: string;
      let confirmation: string;

      if (hasToppingDiv) {
        primaryTrigger = `Enter short when price fails to break above $${ta.nearestResistance.toFixed(2)} resistance AND RSI(14) shows bearish divergence (price making higher highs but RSI making lower highs). Topping signal detected — smart money distributing while retail is greedy.`;
        confirmation = `Confirmation: Funding rate above 0.01% (crowded longs about to get squeezed) AND exchange inflow increasing (sell pressure rising).`;
      } else if (regime.classification === RegimeClassification.BEAR_REGIME) {
        primaryTrigger = `Enter short when price rejects from EMA50 ($${ta.ema50.toFixed(2)}) or nearest resistance ($${ta.nearestResistance.toFixed(2)}) AND RSI(14) turns down from 45-50 zone.`;
        confirmation = `Confirmation: MACD histogram negative AND decreasing AND funding rate above 0% (still some longs to liquidate).`;
      } else {
        primaryTrigger = `Enter short when RSI(14) drops below 45 from above AND price breaks below EMA50 ($${ta.ema50.toFixed(2)}) with volume confirmation.`;
        confirmation = `Confirmation: Smart money distribution signal active AND Fear & Greed Index dropping.`;
      }

      return {
        primaryTrigger,
        confirmation,
        entryPriceZone: { low: entryLow, high: entryHigh },
      };
    }
  }

  // ── Exit Rules Generator ──────────────────────────────────────────────

  private generateExitRules(
    regime: RegimeResult,
    data: CollectedMarketData,
    input: SkillInput,
    riskParams: typeof RISK_PROFILES[RiskProfile],
  ): ExitRules {
    const ta = data.technicalAnalysis;
    const price = data.liveQuote.price;
    const isBullish = regime.compositeScore > 0;

    if (regime.classification === RegimeClassification.CHOPPY) {
      return {
        takeProfit1: { percentage: 0, positionSize: 'N/A — no trade', price: 0 },
        takeProfit2: { price: 0, description: 'N/A — no trade' },
        stopLoss: { price: 0, percentage: 0 },
        trailingStop: { activateAt: 'N/A', trailPercentage: 0 },
        timeStop: { candles: 0, description: 'N/A — no trade regime' },
      };
    }

    if (isBullish) {
      // Long exit rules
      const tp1Pct = 3 * riskParams.tpMultiplier;
      const tp1Price = price * (1 + tp1Pct / 100);
      const slPct = 1.5 * riskParams.slMultiplier;
      const slPrice = ta.nearestSupport * (1 - slPct / 100);

      return {
        takeProfit1: {
          percentage: tp1Pct,
          positionSize: '50% of position',
          price: Math.round(tp1Price * 100) / 100,
        },
        takeProfit2: {
          price: ta.nearestResistance,
          description: `Resistance level at $${ta.nearestResistance.toFixed(2)} — close remaining 50%`,
        },
        stopLoss: {
          price: Math.round(slPrice * 100) / 100,
          percentage: slPct,
        },
        trailingStop: {
          activateAt: 'TP1 hit',
          trailPercentage: riskParams.trailPct,
        },
        timeStop: {
          candles: riskParams.timeStopCandles,
          description: `Exit if no significant movement after ${riskParams.timeStopCandles} ${input.timeframe} candles`,
        },
      };
    } else {
      // Short exit rules
      const tp1Pct = 3 * riskParams.tpMultiplier;
      const tp1Price = price * (1 - tp1Pct / 100);
      const slPct = 1.5 * riskParams.slMultiplier;
      const slPrice = ta.nearestResistance * (1 + slPct / 100);

      return {
        takeProfit1: {
          percentage: tp1Pct,
          positionSize: '50% of position',
          price: Math.round(tp1Price * 100) / 100,
        },
        takeProfit2: {
          price: ta.nearestSupport,
          description: `Support level at $${ta.nearestSupport.toFixed(2)} — close remaining 50%`,
        },
        stopLoss: {
          price: Math.round(slPrice * 100) / 100,
          percentage: slPct,
        },
        trailingStop: {
          activateAt: 'TP1 hit',
          trailPercentage: riskParams.trailPct,
        },
        timeStop: {
          candles: riskParams.timeStopCandles,
          description: `Exit if no significant movement after ${riskParams.timeStopCandles} ${input.timeframe} candles`,
        },
      };
    }
  }

  // ── Position Sizing ───────────────────────────────────────────────────

  private computePositionSizing(
    regime: RegimeResult,
    input: SkillInput,
    riskParams: typeof RISK_PROFILES[RiskProfile],
  ): PositionSizing {
    const baseAllocation = regime.classification === RegimeClassification.CHOPPY
      ? 0
      : riskParams.baseAllocation;

    // Conviction multiplier
    let convictionMultiplier: number;
    if (regime.conviction >= 8) convictionMultiplier = 1.5;
    else if (regime.conviction >= 5) convictionMultiplier = 1.25;
    else convictionMultiplier = 1.0;

    const finalAllocation = Math.min(baseAllocation * convictionMultiplier, 15); // cap at 15%
    const maxRiskPerTrade = 2; // always 2%

    const result: PositionSizing = {
      baseAllocation,
      convictionMultiplier,
      finalAllocation: Math.round(finalAllocation * 100) / 100,
      maxRiskPerTrade,
    };

    if (input.portfolio_size_usd) {
      result.positionSizeUsd = Math.round(input.portfolio_size_usd * (finalAllocation / 100) * 100) / 100;
    }

    return result;
  }

  // ── Invalidation Conditions ───────────────────────────────────────────

  private generateInvalidation(regime: RegimeResult, data: CollectedMarketData, input: SkillInput): string[] {
    const conditions: string[] = [];
    const isBullish = regime.compositeScore > 0;

    // BTC dominance invalidation for altcoins
    if (input.symbol !== 'BTC') {
      if (isBullish) {
        conditions.push(`If BTC dominance rises above ${(data.globalMetrics.btcDominance + 5).toFixed(1)}% within 48h, this altcoin setup is invalidated (capital rotating to BTC).`);
      } else {
        conditions.push(`If BTC dominance drops below ${(data.globalMetrics.btcDominance - 5).toFixed(1)}% within 48h, this bearish altcoin setup may reverse (capital rotating to alts).`);
      }
    }

    // Fear & Greed regime shift
    if (isBullish) {
      conditions.push(`If Fear & Greed Index drops below 25 (currently ${data.globalMetrics.fearGreedIndex}), bullish thesis is invalidated.`);
    } else {
      conditions.push(`If Fear & Greed Index rises above 75 (currently ${data.globalMetrics.fearGreedIndex}), bearish thesis is invalidated.`);
    }

    // Technical invalidation
    const ta = data.technicalAnalysis;
    if (isBullish) {
      conditions.push(`If price closes below $${(ta.nearestSupport * 0.97).toFixed(2)} (3% below nearest support), exit immediately.`);
      conditions.push(`If RSI(14) drops below 30 and MACD crosses bearish, regime has shifted.`);
    } else {
      conditions.push(`If price closes above $${(ta.nearestResistance * 1.03).toFixed(2)} (3% above nearest resistance), exit immediately.`);
      conditions.push(`If RSI(14) rises above 70 and MACD crosses bullish, regime has shifted.`);
    }

    // Funding rate invalidation
    if (isBullish) {
      conditions.push(`If funding rate exceeds 0.05% (extreme greed in leverage), reduce position by 50%.`);
    }

    // Macro event invalidation
    if (data.macroEvents.highImpactCount > 0) {
      conditions.push(`High-impact macro events detected in next 7 days. Consider reducing position size by 25% or exiting before event.`);
    }

    // Divergence-specific invalidation
    for (const div of regime.divergences) {
      if (div.type === DivergenceType.TOPPING_SIGNAL) {
        conditions.push(`TOPPING divergence active: If smart money distribution accelerates (whale % drops by 2%+), exit all positions immediately.`);
      }
      if (div.type === DivergenceType.BOTTOMING_SIGNAL) {
        conditions.push(`BOTTOMING divergence active: If smart money accumulation reverses (exchange inflow spikes), this signal is invalidated.`);
      }
    }

    return conditions;
  }

  // ── Backtest Parameters ───────────────────────────────────────────────

  private generateBacktestParams(input: SkillInput): BacktestParameters {
    return {
      lookbackWindow: LOOKBACK_WINDOWS[input.timeframe],
      dataFrequency: input.timeframe,
      benchmark: 'BTC total return over same period',
      entrySlippage: 0.1,
      exitSlippage: 0.15,
      transactionCost: 0.1,
      minSampleSize: 15,
    };
  }

  // ── Output Formatter ──────────────────────────────────────────────────

  formatJSON(spec: StrategySpec): string {
    return JSON.stringify(spec, null, 2);
  }

  formatMarkdown(spec: StrategySpec): string {
    const lines: string[] = [];

    // Header
    lines.push('╔══════════════════════════════════════════════════════════════╗');
    lines.push('║          RegimeShift — Strategy Specification               ║');
    lines.push('╚══════════════════════════════════════════════════════════════╝');
    lines.push('');

    // Meta
    lines.push(`STRATEGY_NAME:    ${spec.strategyName}`);
    lines.push(`GENERATED_AT:     ${spec.generatedAt}`);
    lines.push(`ASSET:            ${spec.asset}`);
    lines.push(`TIMEFRAME:        ${spec.timeframe}`);
    lines.push(`REGIME:           ${spec.regime}`);
    lines.push(`COMPOSITE_SCORE:  ${spec.compositeScore.toFixed(3)}`);
    lines.push(`CONVICTION:       ${spec.conviction}/10`);
    lines.push('');

    // Signal Breakdown Table
    lines.push('┌─────────────────────────── SIGNAL BREAKDOWN ────────────────────────────┐');
    lines.push('│ Signal                  │ Label         │ Score │ Weight │ Weighted      │');
    lines.push('├─────────────────────────┼───────────────┼───────┼────────┼───────────────┤');
    for (const sig of spec.signalBreakdown.signals) {
      const name = sig.signal.padEnd(23);
      const label = sig.label.padEnd(13);
      const score = (sig.score > 0 ? `+${sig.score}` : `${sig.score}`).padEnd(5);
      const weight = sig.weight.toFixed(2).padEnd(6);
      const weighted = (sig.weightedScore > 0 ? `+${sig.weightedScore.toFixed(3)}` : sig.weightedScore.toFixed(3)).padEnd(13);
      lines.push(`│ ${name} │ ${label} │ ${score} │ ${weight} │ ${weighted} │`);
    }
    lines.push('└─────────────────────────┴───────────────┴───────┴────────┴───────────────┘');
    lines.push('');

    // Entry Rules
    lines.push('── ENTRY RULES ──────────────────────────────────────────────');
    lines.push(`PRIMARY_TRIGGER:  ${spec.entryRules.primaryTrigger}`);
    lines.push(`CONFIRMATION:     ${spec.entryRules.confirmation}`);
    if (spec.entryRules.entryPriceZone.low > 0) {
      lines.push(`ENTRY_PRICE_ZONE: $${spec.entryRules.entryPriceZone.low.toFixed(2)} to $${spec.entryRules.entryPriceZone.high.toFixed(2)}`);
    }
    lines.push('');

    // Exit Rules
    lines.push('── EXIT RULES ───────────────────────────────────────────────');
    if (spec.exitRules.takeProfit1.price > 0) {
      lines.push(`TAKE_PROFIT_1:    +${spec.exitRules.takeProfit1.percentage.toFixed(1)}% from entry ($${spec.exitRules.takeProfit1.price.toFixed(2)}) — ${spec.exitRules.takeProfit1.positionSize}`);
      lines.push(`TAKE_PROFIT_2:    ${spec.exitRules.takeProfit2.description}`);
      lines.push(`STOP_LOSS:        $${spec.exitRules.stopLoss.price.toFixed(2)} (-${spec.exitRules.stopLoss.percentage.toFixed(1)}%)`);
      lines.push(`TRAILING_STOP:    Activate at ${spec.exitRules.trailingStop.activateAt}, trail by ${spec.exitRules.trailingStop.trailPercentage}%`);
      lines.push(`TIME_STOP:        ${spec.exitRules.timeStop.description}`);
    } else {
      lines.push('No trade — CHOPPY regime');
    }
    lines.push('');

    // Position Sizing
    lines.push('── POSITION SIZING ──────────────────────────────────────────');
    lines.push(`BASE_ALLOCATION:       ${spec.positionSizing.baseAllocation}% of portfolio`);
    lines.push(`CONVICTION_MULTIPLIER: ${spec.positionSizing.convictionMultiplier}x`);
    lines.push(`FINAL_ALLOCATION:      ${spec.positionSizing.finalAllocation}%`);
    lines.push(`MAX_RISK_PER_TRADE:    ${spec.positionSizing.maxRiskPerTrade}%`);
    if (spec.positionSizing.positionSizeUsd) {
      lines.push(`POSITION_SIZE_USD:     $${spec.positionSizing.positionSizeUsd.toLocaleString()}`);
    }
    lines.push('');

    // Invalidation
    lines.push('── INVALIDATION ─────────────────────────────────────────────');
    for (const inv of spec.invalidation) {
      lines.push(`• ${inv}`);
    }
    lines.push('');

    // Risk Flags
    if (spec.riskFlags.length > 0) {
      lines.push('── RISK FLAGS ───────────────────────────────────────────────');
      for (const flag of spec.riskFlags) {
        lines.push(`${flag}`);
      }
      lines.push('');
    }

    // Divergences
    lines.push('── DIVERGENCES DETECTED ─────────────────────────────────────');
    if (spec.divergencesDetected.length > 0) {
      for (const div of spec.divergencesDetected) {
        lines.push(`⚡ ${div.type}: ${div.description}`);
        lines.push(`   Conviction impact: ${div.convictionImpact > 0 ? '+' : ''}${div.convictionImpact}`);
      }
    } else {
      lines.push('None');
    }
    lines.push('');

    // Backtest Parameters
    lines.push('── BACKTEST PARAMETERS ──────────────────────────────────────');
    lines.push(`LOOKBACK_WINDOW:          ${spec.backtestParameters.lookbackWindow} days`);
    lines.push(`DATA_FREQUENCY:           ${spec.backtestParameters.dataFrequency}`);
    lines.push(`BENCHMARK:                ${spec.backtestParameters.benchmark}`);
    lines.push(`ENTRY_SLIPPAGE:           ${spec.backtestParameters.entrySlippage}%`);
    lines.push(`EXIT_SLIPPAGE:            ${spec.backtestParameters.exitSlippage}%`);
    lines.push(`TRANSACTION_COST:         ${spec.backtestParameters.transactionCost}% per trade`);
    lines.push(`MIN_SAMPLE_SIZE:          ${spec.backtestParameters.minSampleSize} regime occurrences`);
    lines.push('');

    // Market Snapshot
    lines.push('── MARKET DATA SNAPSHOT ─────────────────────────────────────');
    lines.push(`PRICE:                    $${spec.marketDataSnapshot.price.toFixed(2)}`);
    lines.push(`BTC_DOMINANCE:            ${spec.marketDataSnapshot.btcDominance.toFixed(1)}%`);
    lines.push(`FEAR_GREED_INDEX:         ${spec.marketDataSnapshot.fearGreedIndex}`);
    lines.push(`MARKET_CAP_24H_CHANGE:    ${spec.marketDataSnapshot.totalMarketCap24hChange > 0 ? '+' : ''}${spec.marketDataSnapshot.totalMarketCap24hChange.toFixed(2)}%`);
    lines.push('');

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('Generated by RegimeShift v1.0.0 — CoinMarketCap AI Agent Skill');
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

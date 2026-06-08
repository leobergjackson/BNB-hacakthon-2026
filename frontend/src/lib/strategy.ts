import { DataSource, StrategyParameters, StrategyRequest, StrategySpec } from "./types";

const PROFILE_PARAMS: Record<StrategyRequest["riskProfile"], Pick<StrategyParameters, "riskPerTradePct" | "stopAtrMultiple" | "takeProfitR" | "maxPositionPct" | "rsiMin" | "rsiMax">> = {
  conservative: {
    riskPerTradePct: 0.75,
    stopAtrMultiple: 2.1,
    takeProfitR: 1.35,
    maxPositionPct: 40,
    rsiMin: 42,
    rsiMax: 72
  },
  balanced: {
    riskPerTradePct: 1.1,
    stopAtrMultiple: 1.8,
    takeProfitR: 1.45,
    maxPositionPct: 55,
    rsiMin: 40,
    rsiMax: 76
  },
  aggressive: {
    riskPerTradePct: 1.65,
    stopAtrMultiple: 1.5,
    takeProfitR: 1.65,
    maxPositionPct: 70,
    rsiMin: 38,
    rsiMax: 82
  }
};

export function buildStrategySpec(
  request: StrategyRequest,
  source: DataSource,
  endpoint: string | undefined,
  candleCount: number
): StrategySpec {
  const profile = PROFILE_PARAMS[request.riskProfile];
  const parameters: StrategyParameters = {
    emaFast: 13,
    emaSlow: 34,
    atrPeriod: 14,
    rsiPeriod: 14,
    volumePeriod: 20,
    riskPerTradePct: profile.riskPerTradePct,
    stopAtrMultiple: profile.stopAtrMultiple,
    takeProfitR: profile.takeProfitR,
    maxPositionPct: profile.maxPositionPct,
    rsiMin: profile.rsiMin,
    rsiMax: profile.rsiMax,
    feeBps: request.feeBps,
    slippageBps: request.slippageBps,
    maxDrawdownPct: request.maxDrawdownPct
  };

  return {
    id: `edi-v2-${request.asset.toLowerCase()}-${request.timeframe}-${request.riskProfile}`,
    title: "Emotional Duality Strategy (EDI v2)",
    track: "BNB HACK Track 2: Strategy Skills",
    generatedAt: new Date().toISOString(),
    asset: request.asset,
    timeframe: request.timeframe,
    objective: "Generate a backtestable long-only crypto strategy with explicit risk limits before any live execution.",
    dataInputs: {
      provider: "CoinMarketCap",
      source,
      endpoint,
      fields: ["time", "open", "high", "low", "close", "volume"],
      candles: candleCount
    },
    assumptions: [
      "Signals are evaluated after a candle closes; entries and trend exits fill at the next candle open.",
      "If stop loss and take profit are both touched in the same candle, the stop loss is selected conservatively.",
      "Fees and slippage are deducted on both entry and exit.",
      "No future candles are read when generating an entry, exit, stop, or position size."
    ],
    indicators: [
      `EMA(${parameters.emaFast}) for short-term trend confirmation.`,
      `EMA(${parameters.emaSlow}) for regime filtering.`,
      `ATR(${parameters.atrPeriod}) for stop distance and volatility-aware sizing.`,
      `RSI(${parameters.rsiPeriod}) for momentum quality control.`,
      `SMA(${parameters.volumePeriod}) on volume for liquidity filtering.`
    ],
    entryRules: [
      `Go long only when close > EMA(${parameters.emaFast}) and EMA(${parameters.emaFast}) > EMA(${parameters.emaSlow}).`,
      `Require RSI between ${parameters.rsiMin} and ${parameters.rsiMax}.`,
      `Require current volume above 70% of SMA(${parameters.volumePeriod}) volume.`,
      "Enter at the next candle open with configured slippage."
    ],
    exitRules: [
      `Initial stop loss is entry - ATR(${parameters.atrPeriod}) * ${parameters.stopAtrMultiple}.`,
      `Take profit is ${parameters.takeProfitR}R from entry.`,
      `Exit at next candle open when close falls below EMA(${parameters.emaFast}).`,
      "Force flat at the final candle for deterministic reporting."
    ],
    riskControls: [
      `Risk per trade is capped at ${parameters.riskPerTradePct}% of current equity.`,
      `Position notional is capped at ${parameters.maxPositionPct}% of current equity.`,
      `Strategy review fails if max drawdown exceeds ${parameters.maxDrawdownPct}%.`,
      `Fee assumption: ${parameters.feeBps} bps; slippage assumption: ${parameters.slippageBps} bps.`
    ],
    validation: [
      "Backtest walks forward candle by candle.",
      "Entry signals use closed-candle data and fill on the next open.",
      "Equity curve includes fees, slippage, realized PnL, and mark-to-market open risk.",
      "Report includes win rate, max drawdown, Sharpe ratio, profit factor, and trade log."
    ],
    parameters
  };
}

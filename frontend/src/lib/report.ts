import { runBacktest } from "./backtest";
import { loadMarketDataset } from "./cmc";
import { buildStrategySpec } from "./strategy";
import { ASSETS, RISK_PROFILES, StrategyRequest, StrategyResponse, TIMEFRAMES } from "./types";

export async function createStrategyReport(input: Partial<StrategyRequest> = {}): Promise<StrategyResponse> {
  const request = normalizeRequest(input);
  const dataset = await loadMarketDataset(request);
  const spec = buildStrategySpec(request, dataset.source, dataset.endpoint, dataset.candles.length);
  const result = runBacktest(dataset.candles, spec, request);

  return {
    request,
    dataset: {
      source: dataset.source,
      sourceLabel: dataset.sourceLabel,
      endpoint: dataset.endpoint,
      fallbackReason: dataset.fallbackReason,
      firstCandle: dataset.candles[0].time,
      lastCandle: dataset.candles[dataset.candles.length - 1].time,
      candleCount: dataset.candles.length
    },
    spec,
    metrics: result.metrics,
    equityCurve: result.equityCurve,
    trades: result.trades,
    summary: result.summary
  };
}

export function normalizeRequest(input: Partial<StrategyRequest> | null | undefined): StrategyRequest {
  const safeInput = input ?? {};
  const asset = safeInput.asset && ASSETS.includes(safeInput.asset) ? safeInput.asset : "BNB";
  const timeframe = safeInput.timeframe && TIMEFRAMES.includes(safeInput.timeframe) ? safeInput.timeframe : "4h";
  const riskProfile = safeInput.riskProfile && RISK_PROFILES.includes(safeInput.riskProfile) ? safeInput.riskProfile : "balanced";

  return {
    asset,
    timeframe,
    riskProfile,
    maxDrawdownPct: clamp(Number(safeInput.maxDrawdownPct ?? 18), 5, 45),
    startingEquity: clamp(Number(safeInput.startingEquity ?? 10_000), 1_000, 1_000_000),
    feeBps: clamp(Number(safeInput.feeBps ?? 10), 0, 100),
    slippageBps: clamp(Number(safeInput.slippageBps ?? 8), 0, 250),
    lookbackBars: Math.round(clamp(Number(safeInput.lookbackBars ?? 700), 100, 1000))
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

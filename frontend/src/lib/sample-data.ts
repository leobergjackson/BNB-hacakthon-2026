import { AssetSymbol, MarketCandle, Timeframe } from "./types";

const BASE_PRICE: Record<AssetSymbol, number> = {
  BNB: 680,
  BTC: 105000,
  ETH: 3800,
  SOL: 165
};

const BASE_VOLUME: Record<AssetSymbol, number> = {
  BNB: 1_400_000_000,
  BTC: 48_000_000_000,
  ETH: 24_000_000_000,
  SOL: 5_500_000_000
};

const INTERVAL_MS: Record<Timeframe, number> = {
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000
};

function seedFor(symbol: AssetSymbol): number {
  return symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function generateDemoCandles(symbol: AssetSymbol, timeframe: Timeframe, count: number): MarketCandle[] {
  const seed = seedFor(symbol);
  const interval = INTERVAL_MS[timeframe];
  const start = Date.UTC(2025, 8, 1);
  const volatilityScale = timeframe === "1d" ? 1.6 : timeframe === "4h" ? 1.1 : 0.72;
  const trendBias = symbol === "BNB" ? 0.0009 : symbol === "SOL" ? 0.0005 : 0.00065;

  let close = BASE_PRICE[symbol] * (1 + Math.sin(seed) * 0.02);
  const candles: MarketCandle[] = [];

  for (let i = 0; i < count; i += 1) {
    const cycle = Math.sin((i + seed) / 18) * 0.0038 * volatilityScale;
    const secondary = Math.sin((i * 1.91 + seed) / 7) * 0.0028 * volatilityScale;
    const pullback = Math.sin((i + seed) / 53) < -0.82 ? -0.0065 * volatilityScale : 0;
    const drift = trendBias * (1 + Math.sin((i + seed) / 89) * 0.5);
    const change = drift + cycle + secondary + pullback;

    const open = close;
    close = Math.max(0.01, open * (1 + change));

    const spread = Math.max(0.002, Math.abs(change) * 1.8 + 0.0045 * volatilityScale);
    const high = Math.max(open, close) * (1 + spread * (0.6 + Math.abs(Math.sin(i + seed)) * 0.45));
    const low = Math.min(open, close) * (1 - spread * (0.55 + Math.abs(Math.cos(i + seed)) * 0.38));
    const volumePulse = 1 + Math.abs(Math.sin((i + seed) / 9)) * 0.42 + Math.max(change, 0) * 20;
    const volume = BASE_VOLUME[symbol] * volumePulse;

    candles.push({
      time: new Date(start + i * interval).toISOString(),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(volume)
    });
  }

  return candles;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

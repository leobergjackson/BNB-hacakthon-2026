import { MarketCandle } from "./types";

export function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  let rolling = 0;

  for (let i = 0; i < values.length; i += 1) {
    rolling += values[i];
    if (i >= period) rolling -= values[i - period];
    if (i >= period - 1) out[i] = rolling / period;
  }

  return out;
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let previous: number | null = null;

  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) continue;

    if (previous === null) {
      const window = values.slice(i - period + 1, i + 1);
      previous = window.reduce((sum, value) => sum + value, 0) / period;
    } else {
      previous = values[i] * multiplier + previous * (1 - multiplier);
    }

    out[i] = previous;
  }

  return out;
}

export function atr(candles: MarketCandle[], period: number): Array<number | null> {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });

  const out: Array<number | null> = Array(candles.length).fill(null);
  let previous: number | null = null;

  for (let i = 0; i < trueRanges.length; i += 1) {
    if (i < period - 1) continue;

    if (previous === null) {
      previous = trueRanges.slice(i - period + 1, i + 1).reduce((sum, value) => sum + value, 0) / period;
    } else {
      previous = (previous * (period - 1) + trueRanges[i]) / period;
    }

    out[i] = previous;
  }

  return out;
}

export function rsi(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (i >= period) {
      if (avgLoss === 0) {
        out[i] = 100;
      } else {
        const relativeStrength = avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + relativeStrength);
      }
    }
  }

  return out;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

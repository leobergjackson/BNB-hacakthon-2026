import { atr, ema, finite, rsi, sma, standardDeviation } from "./indicators";
import { BacktestMetrics, EquityPoint, MarketCandle, StrategyRequest, StrategySpec, Trade } from "./types";

interface Position {
  entryIndex: number;
  entryTime: string;
  entryPrice: number;
  quantity: number;
  stopPrice: number;
  takeProfitPrice: number;
  entryFee: number;
}

interface ExitSignal {
  index: number;
  time: string;
  price: number;
  reason: string;
  timing: "current" | "next";
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: Trade[];
  summary: string[];
}

export function runBacktest(candles: MarketCandle[], spec: StrategySpec, request: StrategyRequest): BacktestResult {
  const close = candles.map((candle) => candle.close);
  const volume = candles.map((candle) => candle.volume);
  const fastEma = ema(close, spec.parameters.emaFast);
  const slowEma = ema(close, spec.parameters.emaSlow);
  const atrValues = atr(candles, spec.parameters.atrPeriod);
  const rsiValues = rsi(close, spec.parameters.rsiPeriod);
  const volumeAverage = sma(volume, spec.parameters.volumePeriod);

  const feeRate = spec.parameters.feeBps / 10_000;
  const slippageRate = spec.parameters.slippageBps / 10_000;
  const warmup = Math.max(spec.parameters.emaSlow, spec.parameters.volumePeriod, spec.parameters.atrPeriod, spec.parameters.rsiPeriod) + 2;

  let equity = request.startingEquity;
  let position: Position | null = null;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [{ time: candles[0].time, equity }];

  for (let i = warmup; i < candles.length - 1; i += 1) {
    const candle = candles[i];
    const nextCandle = candles[i + 1];
    let delayedExit: ExitSignal | null = null;

    if (position) {
      const exit = getExit(i, candle, nextCandle, position, fastEma[i], slippageRate);
      if (exit) {
        if (exit.timing === "current") {
          const closed = closePosition(position, exit.index, exit.time, exit.price, exit.reason, equity, feeRate);
          equity = closed.nextEquity;
          trades.push(closed.trade);
          position = null;
        } else {
          delayedExit = exit;
        }
      }
    }

    const markToMarket = position ? equity + (candle.close - position.entryPrice) * position.quantity : equity;
    equityCurve.push({ time: candle.time, equity: Number(markToMarket.toFixed(2)) });

    if (position && delayedExit) {
      const closed = closePosition(position, delayedExit.index, delayedExit.time, delayedExit.price, delayedExit.reason, equity, feeRate);
      equity = closed.nextEquity;
      trades.push(closed.trade);
      position = null;
    }

    if (!position && shouldEnter(i, candles, fastEma, slowEma, atrValues, rsiValues, volumeAverage, spec)) {
      const entryPrice = nextCandle.open * (1 + slippageRate);
      const atrAtSignal = atrValues[i] ?? 0;
      const stopPrice = entryPrice - atrAtSignal * spec.parameters.stopAtrMultiple;
      const stopExitPrice = stopPrice * (1 - slippageRate);
      const riskPerUnit = entryPrice - stopExitPrice + entryPrice * feeRate + stopExitPrice * feeRate;

      if (riskPerUnit > 0) {
        const riskBudget = equity * (spec.parameters.riskPerTradePct / 100);
        const cappedNotional = equity * (spec.parameters.maxPositionPct / 100);
        const rawQuantity = riskBudget / riskPerUnit;
        const quantity = Math.min(rawQuantity, cappedNotional / entryPrice);
        const notional = quantity * entryPrice;
        const entryFee = notional * feeRate;

        if (quantity > 0 && equity > entryFee) {
          equity -= entryFee;
          position = {
            entryIndex: i + 1,
            entryTime: nextCandle.time,
            entryPrice,
            quantity,
            stopPrice,
            takeProfitPrice: entryPrice + (entryPrice - stopPrice) * spec.parameters.takeProfitR,
            entryFee
          };
        }
      }
    }
  }

  if (position) {
    const finalIndex = candles.length - 1;
    const finalCandle = candles[finalIndex];
    const closed = closePosition(position, finalIndex, finalCandle.time, finalCandle.close * (1 - slippageRate), "Final candle", equity, feeRate);
    equity = closed.nextEquity;
    trades.push(closed.trade);
    position = null;
  }

  equityCurve.push({ time: candles[candles.length - 1].time, equity: Number(equity.toFixed(2)) });

  const metrics = computeMetrics(equityCurve, trades, request.startingEquity, timeframePeriodsPerYear(request.timeframe));
  const summary = buildSummary(metrics, spec);

  return { metrics, equityCurve, trades, summary };
}

function shouldEnter(
  index: number,
  candles: MarketCandle[],
  fastEma: Array<number | null>,
  slowEma: Array<number | null>,
  atrValues: Array<number | null>,
  rsiValues: Array<number | null>,
  volumeAverage: Array<number | null>,
  spec: StrategySpec
): boolean {
  const fast = fastEma[index];
  const slow = slowEma[index];
  const atrValue = atrValues[index];
  const rsiValue = rsiValues[index];
  const avgVolume = volumeAverage[index];

  if (fast === null || slow === null || atrValue === null || rsiValue === null || avgVolume === null) return false;

  const candle = candles[index];
  const previous = candles[index - 1];
  const trendOk = candle.close > fast && fast > slow;
  const momentumOk = rsiValue >= spec.parameters.rsiMin && rsiValue <= spec.parameters.rsiMax;
  const liquidityOk = candle.volume >= avgVolume * 0.7;
  const volatilityOk = atrValue / candle.close <= 0.095;
  const notChasing = candle.close <= previous.close * 1.065;

  return trendOk && momentumOk && liquidityOk && volatilityOk && notChasing;
}

function getExit(
  currentIndex: number,
  candle: MarketCandle,
  nextCandle: MarketCandle,
  position: Position,
  fastEma: number | null,
  slippageRate: number
): ExitSignal | null {
  if (candle.low <= position.stopPrice) {
    return {
      index: currentIndex,
      time: candle.time,
      price: position.stopPrice * (1 - slippageRate),
      reason: "Stop loss",
      timing: "current"
    };
  }

  if (candle.high >= position.takeProfitPrice) {
    return {
      index: currentIndex,
      time: candle.time,
      price: position.takeProfitPrice * (1 - slippageRate),
      reason: "Take profit",
      timing: "current"
    };
  }

  if (fastEma !== null && candle.close < fastEma) {
    return {
      index: currentIndex + 1,
      time: nextCandle.time,
      price: nextCandle.open * (1 - slippageRate),
      reason: "Trend exit",
      timing: "next"
    };
  }

  return null;
}

function closePosition(
  position: Position,
  exitIndex: number,
  exitTime: string,
  exitPrice: number,
  reason: string,
  equity: number,
  feeRate: number
): { nextEquity: number; trade: Trade } {
  const grossPnl = (exitPrice - position.entryPrice) * position.quantity;
  const exitFee = exitPrice * position.quantity * feeRate;
  const pnl = grossPnl - position.entryFee - exitFee;
  const nextEquity = equity + grossPnl - exitFee;

  return {
    nextEquity,
    trade: {
      entryTime: position.entryTime,
      exitTime,
      entryPrice: round(position.entryPrice),
      exitPrice: round(exitPrice),
      quantity: round(position.quantity),
      pnl: round(pnl),
      returnPct: round((exitPrice / position.entryPrice - 1) * 100),
      reason,
      barsHeld: Math.max(1, exitIndex - position.entryIndex)
    }
  };
}

function computeMetrics(equityCurve: EquityPoint[], trades: Trade[], startingEquity: number, periodsPerYear: number): BacktestMetrics {
  const endingEquity = equityCurve[equityCurve.length - 1].equity;
  const totalReturnPct = (endingEquity / startingEquity - 1) * 100;
  const winners = trades.filter((trade) => trade.pnl > 0);
  const losers = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = winners.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, trade) => sum + trade.pnl, 0));
  const returns = equityCurve.slice(1).map((point, index) => point.equity / equityCurve[index].equity - 1).filter(Number.isFinite);
  const averageReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const returnStd = standardDeviation(returns);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;

  return {
    totalReturnPct: round(totalReturnPct),
    winRatePct: round(trades.length ? (winners.length / trades.length) * 100 : 0),
    maxDrawdownPct: round(maxDrawdown(equityCurve)),
    sharpeRatio: round(returnStd > 0 ? (averageReturn / returnStd) * Math.sqrt(periodsPerYear) : 0),
    profitFactor: round(Math.min(profitFactor, 99.99)),
    trades: trades.length,
    avgBarsHeld: round(trades.length ? trades.reduce((sum, trade) => sum + trade.barsHeld, 0) / trades.length : 0),
    endingEquity: round(endingEquity)
  };
}

function maxDrawdown(equityCurve: EquityPoint[]): number {
  let peak = equityCurve[0].equity;
  let maxDd = 0;

  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    const drawdown = peak > 0 ? (peak - point.equity) / peak : 0;
    maxDd = Math.max(maxDd, drawdown);
  }

  return maxDd * 100;
}

function buildSummary(metrics: BacktestMetrics, spec: StrategySpec): string[] {
  const drawdownStatus =
    metrics.maxDrawdownPct <= spec.parameters.maxDrawdownPct
      ? "Drawdown gate passed."
      : "Drawdown gate failed; lower risk per trade before deployment.";

  const tradeStatus =
    metrics.trades >= 4
      ? "Trade sample is large enough for a first hackathon demo review."
      : "Trade sample is small; extend lookback before real capital use.";

  return [
    `${spec.asset}/${spec.timeframe} ${spec.parameters.riskPerTradePct}% risk profile generated ${metrics.trades} trades.`,
    `Return ${finite(metrics.totalReturnPct)}%, win rate ${finite(metrics.winRatePct)}%, Sharpe ${finite(metrics.sharpeRatio)}.`,
    drawdownStatus,
    tradeStatus
  ];
}

function timeframePeriodsPerYear(timeframe: StrategyRequest["timeframe"]): number {
  if (timeframe === "1h") return 24 * 365;
  if (timeframe === "4h") return 6 * 365;
  return 365;
}

function round(value: number): number {
  return Number(finite(value).toFixed(2));
}

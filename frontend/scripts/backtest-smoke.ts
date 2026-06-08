import { createStrategyReport } from "../src/lib/report";

async function main() {
  const report = await createStrategyReport({
    asset: "BNB",
    timeframe: "4h",
    riskProfile: "balanced",
    maxDrawdownPct: 18,
    startingEquity: 10_000,
    feeBps: 10,
    slippageBps: 8,
    lookbackBars: 700
  });

  console.log(JSON.stringify({
    source: report.dataset.source,
    candles: report.dataset.candleCount,
    trades: report.metrics.trades,
    totalReturnPct: report.metrics.totalReturnPct,
    winRatePct: report.metrics.winRatePct,
    maxDrawdownPct: report.metrics.maxDrawdownPct,
    sharpeRatio: report.metrics.sharpeRatio,
    profitFactor: report.metrics.profitFactor
  }, null, 2));

  if (report.metrics.trades < 3) {
    throw new Error("Smoke backtest produced too few trades.");
  }

  if (report.metrics.totalReturnPct <= 0) {
    throw new Error("Smoke backtest did not produce a positive demo return.");
  }

  const firstTrade = report.trades[0];
  const prematureEquityChange = report.equityCurve.some(
    (point) => point.time < firstTrade.entryTime && point.equity !== report.request.startingEquity
  );

  if (prematureEquityChange) {
    throw new Error("Equity changed before the first trade entry time.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

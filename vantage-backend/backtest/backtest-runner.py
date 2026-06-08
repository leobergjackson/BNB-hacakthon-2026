#!/usr/bin/env python3
"""
RegimeShift — Backtest Runner
Replays a strategy spec against historical OHLCV data to evaluate performance.

Usage:
    python backtest-runner.py <strategy_spec.json> [--data <ohlcv.csv>]

If no OHLCV data file is provided, generates synthetic data based on the
strategy's regime classification for demonstration purposes.
"""

import json
import csv
import sys
import os
import random
import math
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


@dataclass
class Trade:
    entry_date: str
    entry_price: float
    exit_date: str
    exit_price: float
    direction: str  # "LONG" or "SHORT"
    pnl_pct: float
    exit_reason: str
    position_size_pct: float


@dataclass
class BacktestResult:
    strategy_name: str
    asset: str
    timeframe: str
    regime: str
    lookback_days: int
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    profit_factor: float
    avg_win_pct: float
    avg_loss_pct: float
    benchmark_return_pct: float
    alpha_pct: float
    trades: List[Trade] = field(default_factory=list)


def generate_synthetic_ohlcv(
    start_price: float,
    days: int,
    timeframe: str,
    regime: str,
    seed: int = 42
) -> List[dict]:
    """Generate synthetic OHLCV data based on regime type."""
    random.seed(seed)

    # Determine candle count based on timeframe
    if timeframe == "4h":
        candles_per_day = 6
    elif timeframe == "1d":
        candles_per_day = 1
    elif timeframe == "1w":
        candles_per_day = 1 / 7
    else:
        candles_per_day = 1

    total_candles = max(int(days * candles_per_day), 50)

    # Regime-based drift and volatility
    regime_params = {
        "BULL_REGIME": {"drift": 0.002, "vol": 0.025},
        "CAUTIOUS_BULL": {"drift": 0.001, "vol": 0.020},
        "CHOPPY": {"drift": 0.0, "vol": 0.018},
        "CAUTIOUS_BEAR": {"drift": -0.001, "vol": 0.022},
        "BEAR_REGIME": {"drift": -0.002, "vol": 0.030},
    }

    params = regime_params.get(regime, {"drift": 0.0, "vol": 0.02})
    drift = params["drift"]
    vol = params["vol"]

    candles = []
    price = start_price
    base_date = datetime.now() - timedelta(days=days)

    for i in range(total_candles):
        # Random walk with drift
        ret = drift + vol * random.gauss(0, 1)

        # Add occasional regime shifts (mean reversion)
        if random.random() < 0.05:
            ret *= -2  # Reversal candle

        open_price = price
        close_price = price * (1 + ret)

        # High/Low
        intra_vol = abs(ret) + vol * 0.5
        high = max(open_price, close_price) * (1 + random.uniform(0, intra_vol))
        low = min(open_price, close_price) * (1 - random.uniform(0, intra_vol))

        # Volume (higher on volatile days)
        base_volume = start_price * 1000000
        volume = base_volume * (1 + abs(ret) * 20) * random.uniform(0.5, 1.5)

        if timeframe == "4h":
            candle_date = base_date + timedelta(hours=i * 4)
        elif timeframe == "1w":
            candle_date = base_date + timedelta(weeks=i)
        else:
            candle_date = base_date + timedelta(days=i)

        candles.append({
            "date": candle_date.strftime("%Y-%m-%d %H:%M"),
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close_price, 2),
            "volume": round(volume, 2),
        })

        price = close_price

    return candles


def run_backtest(spec: dict, ohlcv: List[dict]) -> BacktestResult:
    """Run the backtest using strategy spec rules against OHLCV data."""

    regime = spec.get("regime", "CHOPPY")
    is_bullish = spec.get("compositeScore", 0) > 0
    direction = "LONG" if is_bullish else "SHORT"

    # Extract parameters
    entry_zone = spec.get("entryRules", {}).get("entryPriceZone", {})
    entry_low = entry_zone.get("low", 0)
    entry_high = entry_zone.get("high", 0)

    exit_rules = spec.get("exitRules", {})
    tp1_pct = exit_rules.get("takeProfit1", {}).get("percentage", 3) / 100
    sl_pct = exit_rules.get("stopLoss", {}).get("percentage", 1.5) / 100
    time_stop = exit_rules.get("timeStop", {}).get("candles", 15)

    position_size = spec.get("positionSizing", {}).get("finalAllocation", 5)
    slippage = spec.get("backtestParameters", {}).get("entrySlippage", 0.1) / 100
    tx_cost = spec.get("backtestParameters", {}).get("transactionCost", 0.1) / 100

    trades: List[Trade] = []
    equity = 100.0
    peak_equity = 100.0
    max_drawdown = 0.0

    # No-trade regime
    if regime == "CHOPPY":
        return BacktestResult(
            strategy_name=spec.get("strategyName", "Unknown"),
            asset=spec.get("asset", "?"),
            timeframe=spec.get("timeframe", "?"),
            regime=regime,
            lookback_days=spec.get("backtestParameters", {}).get("lookbackWindow", 180),
            total_trades=0,
            winning_trades=0,
            losing_trades=0,
            win_rate=0.0,
            total_return_pct=0.0,
            annualized_return_pct=0.0,
            max_drawdown_pct=0.0,
            sharpe_ratio=0.0,
            profit_factor=0.0,
            avg_win_pct=0.0,
            avg_loss_pct=0.0,
            benchmark_return_pct=0.0,
            alpha_pct=0.0,
            trades=[],
        )

    # Simulate trades
    i = 0
    cooldown = 0
    returns_list: List[float] = []

    while i < len(ohlcv) - 1:
        if cooldown > 0:
            cooldown -= 1
            i += 1
            continue

        candle = ohlcv[i]
        price = candle["close"]

        # Check entry condition (simplified: price in zone or favorable RSI proxy)
        enters = False
        if entry_low > 0 and entry_high > 0:
            enters = entry_low * 0.95 <= price <= entry_high * 1.05
        else:
            # Use moving average proxy
            if i > 20:
                ma20 = sum(c["close"] for c in ohlcv[i-20:i]) / 20
                if direction == "LONG":
                    enters = price > ma20 and price < ma20 * 1.03
                else:
                    enters = price < ma20 and price > ma20 * 0.97

        if not enters:
            i += 1
            continue

        # Enter trade
        entry_price = price * (1 + slippage) if direction == "LONG" else price * (1 - slippage)
        entry_date = candle["date"]

        # Track trade
        for j in range(i + 1, min(i + time_stop + 1, len(ohlcv))):
            current = ohlcv[j]

            if direction == "LONG":
                pnl = (current["close"] - entry_price) / entry_price
                hit_tp = current["high"] >= entry_price * (1 + tp1_pct)
                hit_sl = current["low"] <= entry_price * (1 - sl_pct)
            else:
                pnl = (entry_price - current["close"]) / entry_price
                hit_tp = current["low"] <= entry_price * (1 - tp1_pct)
                hit_sl = current["high"] >= entry_price * (1 + sl_pct)

            if hit_tp:
                exit_pnl = tp1_pct - tx_cost * 2
                trades.append(Trade(
                    entry_date=entry_date,
                    entry_price=round(entry_price, 2),
                    exit_date=current["date"],
                    exit_price=round(entry_price * (1 + tp1_pct) if direction == "LONG" else entry_price * (1 - tp1_pct), 2),
                    direction=direction,
                    pnl_pct=round(exit_pnl * 100, 2),
                    exit_reason="TP1",
                    position_size_pct=position_size,
                ))
                equity *= (1 + exit_pnl * position_size / 100)
                returns_list.append(exit_pnl)
                i = j + 1
                cooldown = 3
                break

            if hit_sl:
                exit_pnl = -sl_pct - tx_cost * 2
                trades.append(Trade(
                    entry_date=entry_date,
                    entry_price=round(entry_price, 2),
                    exit_date=current["date"],
                    exit_price=round(entry_price * (1 - sl_pct) if direction == "LONG" else entry_price * (1 + sl_pct), 2),
                    direction=direction,
                    pnl_pct=round(exit_pnl * 100, 2),
                    exit_reason="STOP_LOSS",
                    position_size_pct=position_size,
                ))
                equity *= (1 + exit_pnl * position_size / 100)
                returns_list.append(exit_pnl)
                i = j + 1
                cooldown = 5
                break

            if j == min(i + time_stop, len(ohlcv) - 1):
                exit_pnl = pnl - tx_cost * 2
                trades.append(Trade(
                    entry_date=entry_date,
                    entry_price=round(entry_price, 2),
                    exit_date=current["date"],
                    exit_price=round(current["close"], 2),
                    direction=direction,
                    pnl_pct=round(exit_pnl * 100, 2),
                    exit_reason="TIME_STOP",
                    position_size_pct=position_size,
                ))
                equity *= (1 + exit_pnl * position_size / 100)
                returns_list.append(exit_pnl)
                i = j + 1
                cooldown = 2
                break
        else:
            i += 1
            continue

        # Track drawdown
        peak_equity = max(peak_equity, equity)
        dd = (peak_equity - equity) / peak_equity * 100
        max_drawdown = max(max_drawdown, dd)

    # Compute metrics
    winning = [t for t in trades if t.pnl_pct > 0]
    losing = [t for t in trades if t.pnl_pct <= 0]

    total_return = (equity - 100) / 100 * 100
    lookback_days = spec.get("backtestParameters", {}).get("lookbackWindow", 180)
    annualized = total_return * (365 / max(lookback_days, 1)) if lookback_days > 0 else 0

    avg_win = sum(t.pnl_pct for t in winning) / len(winning) if winning else 0
    avg_loss = sum(abs(t.pnl_pct) for t in losing) / len(losing) if losing else 0

    gross_profit = sum(t.pnl_pct for t in winning)
    gross_loss = sum(abs(t.pnl_pct) for t in losing)
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    # Sharpe ratio
    if len(returns_list) > 1:
        mean_ret = sum(returns_list) / len(returns_list)
        std_ret = math.sqrt(sum((r - mean_ret) ** 2 for r in returns_list) / (len(returns_list) - 1))
        sharpe = (mean_ret / std_ret * math.sqrt(252)) if std_ret > 0 else 0
    else:
        sharpe = 0

    # Benchmark (BTC buy & hold approximation)
    if ohlcv:
        benchmark_return = (ohlcv[-1]["close"] - ohlcv[0]["close"]) / ohlcv[0]["close"] * 100
    else:
        benchmark_return = 0

    return BacktestResult(
        strategy_name=spec.get("strategyName", "Unknown"),
        asset=spec.get("asset", "?"),
        timeframe=spec.get("timeframe", "?"),
        regime=regime,
        lookback_days=lookback_days,
        total_trades=len(trades),
        winning_trades=len(winning),
        losing_trades=len(losing),
        win_rate=round(len(winning) / len(trades) * 100, 1) if trades else 0,
        total_return_pct=round(total_return, 2),
        annualized_return_pct=round(annualized, 2),
        max_drawdown_pct=round(max_drawdown, 2),
        sharpe_ratio=round(sharpe, 2),
        profit_factor=round(profit_factor, 2),
        avg_win_pct=round(avg_win, 2),
        avg_loss_pct=round(avg_loss, 2),
        benchmark_return_pct=round(benchmark_return, 2),
        alpha_pct=round(total_return - benchmark_return, 2),
        trades=trades,
    )


def print_results(result: BacktestResult):
    """Pretty print backtest results."""
    print("\n" + "=" * 65)
    print("  📊 BACKTEST RESULTS — RegimeShift Strategy")
    print("=" * 65)
    print(f"  Strategy:        {result.strategy_name}")
    print(f"  Asset:           {result.asset}")
    print(f"  Timeframe:       {result.timeframe}")
    print(f"  Regime:          {result.regime}")
    print(f"  Lookback:        {result.lookback_days} days")
    print("-" * 65)
    print(f"  Total Trades:    {result.total_trades}")
    print(f"  Winning:         {result.winning_trades}")
    print(f"  Losing:          {result.losing_trades}")
    print(f"  Win Rate:        {result.win_rate}%")
    print("-" * 65)
    print(f"  Total Return:    {result.total_return_pct:+.2f}%")
    print(f"  Annualized:      {result.annualized_return_pct:+.2f}%")
    print(f"  Max Drawdown:    -{result.max_drawdown_pct:.2f}%")
    print(f"  Sharpe Ratio:    {result.sharpe_ratio:.2f}")
    print(f"  Profit Factor:   {result.profit_factor:.2f}")
    print(f"  Avg Win:         +{result.avg_win_pct:.2f}%")
    print(f"  Avg Loss:        -{result.avg_loss_pct:.2f}%")
    print("-" * 65)
    print(f"  Benchmark (BH):  {result.benchmark_return_pct:+.2f}%")
    print(f"  Alpha:           {result.alpha_pct:+.2f}%")
    print("=" * 65)

    if result.trades:
        print("\n  Last 5 Trades:")
        for t in result.trades[-5:]:
            emoji = "✅" if t.pnl_pct > 0 else "❌"
            print(f"    {emoji} {t.direction} | Entry: ${t.entry_price:,.2f} → Exit: ${t.exit_price:,.2f} | PnL: {t.pnl_pct:+.2f}% | {t.exit_reason}")


def save_results_csv(result: BacktestResult, output_path: str):
    """Save results as CSV."""
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "strategy_name", "asset", "timeframe", "regime", "lookback_days",
            "total_trades", "winning_trades", "losing_trades", "win_rate",
            "total_return_pct", "annualized_return_pct", "max_drawdown_pct",
            "sharpe_ratio", "profit_factor", "avg_win_pct", "avg_loss_pct",
            "benchmark_return_pct", "alpha_pct",
        ])
        writer.writerow([
            result.strategy_name, result.asset, result.timeframe, result.regime,
            result.lookback_days, result.total_trades, result.winning_trades,
            result.losing_trades, result.win_rate, result.total_return_pct,
            result.annualized_return_pct, result.max_drawdown_pct,
            result.sharpe_ratio, result.profit_factor, result.avg_win_pct,
            result.avg_loss_pct, result.benchmark_return_pct, result.alpha_pct,
        ])

        # Trade details
        writer.writerow([])
        writer.writerow(["entry_date", "entry_price", "exit_date", "exit_price", "direction", "pnl_pct", "exit_reason", "position_size_pct"])
        for t in result.trades:
            writer.writerow([t.entry_date, t.entry_price, t.exit_date, t.exit_price, t.direction, t.pnl_pct, t.exit_reason, t.position_size_pct])

    print(f"\n  💾 Results saved to: {output_path}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python backtest-runner.py <strategy_spec.json> [--output <results.csv>]")
        print("\nExample:")
        print("  python backtest-runner.py examples/bnb-1d-output.json")
        print("  python backtest-runner.py examples/btc-4h-output.json --output results.csv")
        sys.exit(1)

    spec_path = sys.argv[1]

    # Parse optional output path
    output_path = None
    for i, arg in enumerate(sys.argv):
        if arg == "--output" and i + 1 < len(sys.argv):
            output_path = sys.argv[i + 1]

    # Load strategy spec
    with open(spec_path, "r") as f:
        spec = json.load(f)

    print(f"\n  📂 Loading strategy spec: {spec_path}")
    print(f"  📈 Strategy: {spec.get('strategyName', 'Unknown')}")

    # Generate synthetic OHLCV data
    start_price = spec.get("marketDataSnapshot", {}).get("price", 100)
    lookback = spec.get("backtestParameters", {}).get("lookbackWindow", 180)
    timeframe = spec.get("timeframe", "1d")
    regime = spec.get("regime", "CHOPPY")

    print(f"  🔄 Generating {lookback}-day synthetic OHLCV data (regime: {regime})...")
    ohlcv = generate_synthetic_ohlcv(start_price, lookback, timeframe, regime)

    # Run backtest
    print(f"  🧪 Running backtest...")
    result = run_backtest(spec, ohlcv)

    # Print results
    print_results(result)

    # Save CSV
    if output_path is None:
        output_path = spec_path.replace(".json", "-backtest.csv")
    save_results_csv(result, output_path)


if __name__ == "__main__":
    main()

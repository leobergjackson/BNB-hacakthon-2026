# RiskGuard Strategy Skill

Use this skill when a user wants a backtestable crypto strategy specification from market data instead of a live trading agent.

## Purpose

RiskGuard generates an auditable strategy spec for BNB HACK Track 2: Strategy Skills. The output is meant for research, backtesting, and review before any execution layer is built.

## Inputs

- `asset`: `BNB`, `BTC`, `ETH`, or `SOL`
- `timeframe`: `1h`, `4h`, or `1d`
- `riskProfile`: `conservative`, `balanced`, or `aggressive`
- `maxDrawdownPct`: maximum acceptable drawdown gate
- `startingEquity`: simulated account equity
- `feeBps`: trading fee in basis points
- `slippageBps`: slippage assumption in basis points
- `lookbackBars`: historical candles to evaluate

## Data Source

Prefer CoinMarketCap OHLCV data through `CMC_PRO_API_KEY`. If the key is absent, use the deterministic demo dataset so the skill remains runnable for judges without secrets.

## Strategy Logic

1. Compute EMA(13), EMA(34), ATR(14), RSI(14), and SMA(20) volume.
2. Enter long only after a closed candle confirms trend, momentum, liquidity, and volatility filters.
3. Fill entries at the next candle open with slippage.
4. Set stop loss with ATR distance and take profit as an R multiple.
5. Deduct fees and slippage on entry and exit.
6. Fail the review gate if realized max drawdown is above the user limit.

## No-Lookahead Rules

- Signals use only closed candles at or before the signal index.
- Market entries and trend exits fill on the next candle open.
- Stop loss and take profit checks use the current candle after a position exists.
- If stop loss and take profit are both touched in one candle, select stop loss conservatively.

## Output

Return:

- JSON strategy spec
- Backtest metrics: total return, win rate, max drawdown, Sharpe ratio, profit factor, trade count
- Equity curve
- Trade log
- Risk narrative explaining whether the drawdown and sample-size gates passed

## Local Invocation

Run the app:

```bash
npm run dev
```

Call the API:

```bash
curl -X POST http://localhost:3000/api/strategy \
  -H "Content-Type: application/json" \
  -d '{"asset":"BNB","timeframe":"4h","riskProfile":"balanced","maxDrawdownPct":18,"startingEquity":10000,"feeBps":10,"slippageBps":8,"lookbackBars":700}'
```

Run the smoke backtest:

```bash
npm run backtest
```

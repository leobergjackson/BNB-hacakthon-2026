# Demo Video Script

Target length: 2 to 3 minutes.

Live demo:

https://riskguard-cmc-strategy-skill.vercel.app

Prepared no-audio backup video:

https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill/releases/download/demo-v1/riskguard-demo.mp4

## Opening

RiskGuard is a Track 2 Strategy Skills project for BNB HACK. It does not try to execute live trades. Instead, it generates a backtestable crypto strategy specification using CoinMarketCap-oriented market data, then validates the strategy with explicit no-lookahead rules, fees, slippage, stop loss, take profit, position sizing, and drawdown controls.

## Walkthrough

1. Open the live demo.
2. Show the default BNB / 4h / balanced report.
3. Point to the six headline metrics: return, win rate, max drawdown, Sharpe ratio, profit factor, and trade count.
4. Show the equity curve and data source panel.
5. Explain that the project uses CoinMarketCap OHLCV when `CMC_PRO_API_KEY` is available and deterministic fallback data when no key is configured.
6. Switch risk profile from balanced to aggressive.
7. Show that the report regenerates and the metrics change.
8. Click `Generate Strategy` again and point to the generated run counter.
9. Scroll to the trade log and show entry/exit prices, PnL, and exit reasons.
10. Scroll to the JSON strategy spec.
11. Highlight the assumptions section: closed-candle signals, next-open fills, fees, slippage, and no future candles.
12. Click `Export JSON`.

## Closing

RiskGuard is useful because it keeps trading-agent development honest. Before adding an execution layer, the strategy must be expressed as a testable spec, and the report must prove how it handles entry, exit, stop loss, take profit, fees, slippage, position sizing, and drawdown. That is why this project targets Track 2: Strategy Skills and Best Use of CoinMarketCap.

## Short Voiceover

RiskGuard generates a backtestable strategy spec instead of a live trading bot. The user selects an asset, timeframe, and risk profile. The system builds a CoinMarketCap-oriented strategy with EMA trend filters, RSI momentum filters, volume checks, ATR stop loss, R-multiple take profit, and risk-based position sizing. The backtest walks candle by candle, uses only closed-candle signals, fills entries and trend exits on the next open, and deducts fees and slippage on both sides. The dashboard then shows return, win rate, max drawdown, Sharpe ratio, profit factor, equity curve, trade log, and an exportable JSON spec.

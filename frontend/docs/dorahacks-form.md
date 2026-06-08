# DoraHacks Form Copy

Use this as copy-paste material for the BUIDL submission.

## Project Name

RiskGuard CMC Strategy Skill

## One-Line Description

An AI-agent-style CoinMarketCap strategy skill that generates no-lookahead, backtestable crypto trading specs with explicit risk controls.

## Short Description

RiskGuard uses CoinMarketCap-oriented market data to generate a backtestable crypto strategy specification. It includes deterministic OHLCV fallback data for judge-friendly execution, strict no-lookahead signal timing, fees, slippage, ATR stop loss, R-multiple take profit, position sizing, max drawdown gating, equity curve, trade log, win rate, Sharpe ratio, and profit factor.

## Problem

Many trading-agent demos jump directly to execution without proving whether the strategy is testable, explainable, or risk-controlled. Track 2 is better served by a research-first skill that produces an auditable strategy spec before live trading.

## Solution

RiskGuard turns asset, timeframe, and risk profile inputs into a JSON strategy spec and a full backtest report. The report explains entry rules, exit rules, risk assumptions, data source, no-lookahead validation, and performance metrics.

## Sponsor Stack

- CoinMarketCap historical OHLCV API integration through `CMC_PRO_API_KEY`
- CoinMarketCap-style AI skill file in `skills/riskguard-strategy-skill/SKILL.md`
- Deterministic demo OHLCV fallback when no API key is available

## Track

Track 2: Strategy Skills

## Prize Targets

- Track 2: Strategy Skills
- Best Use of Agent Hub / CoinMarketCap

## Technical Highlights

- Next.js dashboard and API route
- TypeScript backtest engine
- EMA, ATR, RSI, and volume filters
- No-lookahead entry and exit timing
- Fees and slippage on both entry and exit
- ATR stop loss and R-multiple take profit
- Risk-based position sizing
- Max drawdown, Sharpe ratio, profit factor, win rate, and trade log
- API input normalization and bad-JSON handling
- Race-condition protection for fast UI parameter changes

## Links To Add

- GitHub: https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill
- Demo: https://riskguard-cmc-strategy-skill.vercel.app
- Video: https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill/releases/download/demo-v1/riskguard-demo.mp4
- Screenshots:
  - https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill/blob/main/docs/assets/riskguard-dashboard-balanced.jpg
  - https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill/blob/main/docs/assets/riskguard-dashboard-aggressive.jpg
  - https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill/blob/main/docs/assets/riskguard-strategy-json.jpg

## Suggested Tags

CoinMarketCap, AI Agents, Strategy Skills, Backtesting, Quant Trading, Risk Management, Crypto, BNB Hack

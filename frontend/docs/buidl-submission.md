# DoraHacks BUIDL Submission Draft

## Project Name

RiskGuard CMC Strategy Skill

## Short Description

RiskGuard uses CoinMarketCap market data to generate a backtestable crypto strategy specification with no-lookahead validation, fees, slippage, position sizing, stop loss, take profit, and drawdown controls.

## Track

Track 2: Strategy Skills

## Prize Targets

- Track 2: Strategy Skills
- Best Use of Agent Hub / CoinMarketCap

## Sponsor Stack Used

- CoinMarketCap historical OHLCV data endpoint
- CoinMarketCap-oriented strategy skill format
- Optional `CMC_PRO_API_KEY` integration
- Deterministic fallback data for judge-friendly local execution

## Deliverables

- GitHub repository: https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill
- Live demo: https://riskguard-cmc-strategy-skill.vercel.app
- Demo video: https://github.com/G-Oct15-Lib/riskguard-cmc-strategy-skill/releases/download/demo-v1/riskguard-demo.mp4
- `skills/riskguard-strategy-skill/SKILL.md`
- `README.md`
- Strategy JSON export from the app
- Smoke backtest output from `npm run backtest`
- Screenshots:
  - `docs/assets/riskguard-dashboard-balanced.jpg`
  - `docs/assets/riskguard-dashboard-aggressive.jpg`
  - `docs/assets/riskguard-strategy-json.jpg`

## Demo Script

1. Open the dashboard.
2. Show default BNB/4h balanced report.
3. Point out return, win rate, max drawdown, Sharpe, profit factor, and trade count.
4. Switch risk profile to aggressive and generate a new report.
5. Export the JSON strategy spec.
6. Open the JSON section and highlight no-lookahead, entry, exit, fees, slippage, and risk controls.

## Judging Narrative

- Technical execution: deterministic TypeScript backtest engine, API route, and dashboard.
- Originality: combines AI-agent-style strategy skill output with quant risk controls.
- Real-world relevance: designed for crypto strategy research before execution.
- Demo clarity: a judge can run without API secrets, then add a CoinMarketCap key for live historical data.

## Final Checklist

- [x] GitHub repo is public.
- [x] Vercel demo URL is live.
- [x] Demo video is uploaded.
- [ ] DoraHacks BUIDL uses `Track 2: Strategy Skills`.
- [ ] `Best Use of Agent Hub / CoinMarketCap` is selected if available.
- [x] README, skill file, screenshots, and smoke backtest output are linked or mentioned.

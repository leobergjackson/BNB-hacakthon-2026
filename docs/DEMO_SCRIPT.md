# NeuroSentiment Trader - Demo Video Script

**Target Length**: 3-5 minutes
**Format**: Screen recording with voiceover
**Preparation**: Ensure the agent is running in the background (`npm run start --dev`) and the dashboard is open (`npm run dashboard`). Have a BSCScan tab open for transaction verification.

---

### [0:00 - 0:30] Hook
*(Visuals: Title card with project name and logo, then fast-paced cuts showing the CLI dashboard lighting up with trades and logs).*

**Voiceover:**
"Welcome to the NeuroSentiment Trader—an autonomous AI trading agent built for the BNB Hackathon. This agent reads market sentiment, sizes positions dynamically, and executes trades directly on the Binance Smart Chain, with absolute zero human intervention. From the moment it starts, it runs on autopilot, adapting to market regimes on the fly."

---

### [0:30 - 1:30] Architecture Overview
*(Visuals: Display an architecture diagram. Use callouts or highlight boxes as each layer is mentioned).*

**Voiceover:**
"Under the hood, NeuroSentiment Trader operates across three distinct layers:
1. **Data Layer**: We ingest real-time pricing, funding rates, and social sentiment straight from the CoinMarketCap AI Agent Hub.
2. **Decision Layer**: Our Strategy Engine calculates sentiment divergence against price action to detect risk-on or risk-off regimes.
3. **Execution Layer**: Every trade is processed through the Trust Wallet Agent Kit (TWAK), ensuring execution is fully self-custodial. The keys never leave our local environment.

Crucially, the agent is **native x402 compliant**. It autonomously negotiates and signs micropayment tokens via TWAK to purchase premium data from the CMC Agent Hub before making a decision."

---

### [1:30 - 3:00] Live Demo
*(Visuals: Split screen or sequence showing the terminal. First `npm run preflight`, then the Dashboard).*

**Voiceover:**
"Let’s see it in action. Before deployment, our automated preflight checklist validates API connections, ensures local signing capability, and checks that our 28% drawdown guardrails are active.

With preflight green, we start the agent. Notice the dashboard on the right. It tracks portfolio value, PnL, and the current market regime in real-time.

Watch closely—the agent just detected an opportunity. The Fear & Greed index has dropped to 25, but social sentiment is diverging from the price action. The agent determines this is a high-confidence accumulation signal. It generates a buy order for BTC via PancakeSwap.

Here is the executed trade in the logs. We take this transaction hash and pop it into BSCScan—*(Switch to BSCScan tab)*—and there it is, successfully executed on-chain via TWAK.

Simultaneously, observe the x402 metrics on the dashboard. The agent is continuously paying for its data pulls, keeping strict accounting against a $5.00 daily hard cap to prevent runaway costs."

---

### [3:00 - 4:00] Strategy & Risk Management
*(Visuals: Switch to the `backtest_report.json` output, then highlight the `RiskManager` log stream).*

**Voiceover:**
"Profitable trading is useless without strict risk management. Our core strategy relies on sentiment divergence—trading the psychological extremes of the market. We ran extensive backtesting over 30 days of historical data, achieving solid returns with an optimal Sharpe ratio.

But live markets are volatile. That's why our Risk Manager acts as a rigid, impenetrable gatekeeper. It enforces a strict 5% max allocation per trade, limits single-token exposure to 20%, and most importantly, enforces a hard stop if the portfolio drawdown hits 28%—ensuring we stay well clear of the hackathon's 30% disqualification threshold."

---

### [4:00 - 4:30] Closing
*(Visuals: Return to the active CLI dashboard, zooming out slightly to show it running peacefully. End with a slide containing project links).*

**Voiceover:**
"To recap: The NeuroSentiment Trader is a fully autonomous, self-custodial, and sentiment-aware agent natively utilizing x402 micropayments. It manages risk relentlessly and executes precisely.

It's currently running hands-off, managing its portfolio independently. Thank you for watching, and we look forward to seeing what autonomous agents will achieve next on the BNB Chain."

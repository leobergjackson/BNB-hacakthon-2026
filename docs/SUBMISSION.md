# BNB Hackathon Submission: NeuroSentiment Trader

**Project Title:** NeuroSentiment Trader  
**One-Line Description:** An autonomous, self-custodial AI trading agent that identifies market regime shifts via sentiment divergence and executes risk-managed trades natively on BSC.

**Team:** Solo Developer  
**Track:** Track 1 (AI Agents) + Targeting *Best Use of Agent Hub* Special Prize  
**Agent Wallet Address:** `0xca8B5dDE2e6D4514F6d2c45042A2Ca83aC613E97` *(Placeholder for actual TWAK address)*  
**GitHub Repository:** `https://github.com/yourusername/neurosentiment-trader` *(Placeholder)*  

---

## Architecture

The NeuroSentiment Trader operates securely and autonomously through a cleanly decoupled architecture:

```text
+-------------------------------------------------------------+
|                     CMC AI Agent Hub                        |
|  (Provides Prices, Fear/Greed, Social Heat, Funding Rates)  |
+------------------------------+------------------------------+
                               |
                               v (via x402 Micropayments)
+------------------------------+------------------------------+
|                      Data Aggregation                       |
|           /src/data (Price, Sentiment, Derivatives)         |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                       Strategy Engine                       |
|   /src/strategy (Regime Detection, Sentiment Divergence)    |
+------------------------------+------------------------------+
                               |
                               v (Proposed Trades)
+------------------------------+------------------------------+
|                        Risk Manager                         |
|   /src/risk (Drawdown Caps, Position Limits, Hard Stops)    |
+------------------------------+------------------------------+
                               |
                               v (Approved Trades)
+------------------------------+------------------------------+
|                      Execution Engine                       |
|           /src/execution (Slippage, Gas Estimator)          |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                Trust Wallet Agent Kit (TWAK)                |
|      (Self-Custodial Local Signing & Tx Broadcasting)       |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|                     Binance Smart Chain                     |
|           (PancakeSwap Execution & Registration)            |
+-------------------------------------------------------------+
```

---

## Core Strategy Explanation

NeuroSentiment Trader does not rely on simple momentum or moving averages. Instead, it plays the **psychology of the market** through a dynamic Sentiment Divergence framework.

1. **Regime Detection**: The agent first queries the CMC Agent Hub to determine the macro environment (Fear & Greed index). It assigns the market a state: `risk-on`, `risk-off`, or `neutral`.
2. **Sentiment Divergence**: For each token in the allowlist, the agent pulls social heat and compares it to recent price action. The core philosophy is that extreme social hype coupled with failing momentum indicates a top (sell signal), whereas extreme fear coupled with stabilizing momentum indicates accumulation (buy signal).
3. **Dynamic Sizing**: Position sizing is scaled linearly by the strategy engine's confidence score and heavily clamped by the `RiskManager`.
4. **Absolute Risk Containment**: Before any trade hits the BSC network, the `RiskManager` evaluates the portfolio. If the agent's drawdown approaches 28%, trading is frozen, preventing the agent from hitting the 30% disqualification threshold.

## Special Prize Adherence: Best Use of Agent Hub

This project was built from the ground up to natively integrate **x402 Micropayments**:
- **Fully Integrated**: Every data fetch (Prices, Sentiment, Derivatives) from the Agent Hub flows through a centralized `X402Client`.
- **Self-Custodial Payments**: The client interfaces directly with TWAK to sign L402 payment headers locally, ensuring that private keys never leak.
- **Budget Guardrails**: The `X402Client` tracks a rigid session limit (e.g., $5.00 daily cap) and gracefully halts data fetching if the agent over-consumes.
- **Auditable**: Every micropayment is independently logged (`logs/x402.jsonl`) and surfaced on the CLI dashboard in real-time.

# NeuroSentiment Trader

An AI-driven trading agent designed for the **BNB Hack**. It autonomously reads market sentiment data from CoinMarketCap (via CMC AI Agent Hub), formulates trading strategies, and executes trades safely on the BNB Smart Chain (BSC) using the Trust Wallet Agent Kit (TWAK).

## Architecture Overview

The system is built on a modular Node.js architecture with the following core components:

*   **`/src/data`**: Responsible for interacting with the CoinMarketCap AI Agent Hub (MCP + x402) to fetch real-time price feeds, fear & greed indexes, sentiment scores, and social metrics.
*   **`/src/strategy`**: The brain of the agent. It ingests data, evaluates current market regimes, and generates buy/sell signals based on AI sentiment models.
*   **`/src/execution`**: Connects to the BNB Smart Chain. It uses the Trust Wallet Agent Kit (TWAK) for secure, self-custody transaction signing and trade execution (routing through DEXs on BSC).
*   **`/src/risk`**: Implements safety guardrails. Monitors the portfolio's max drawdown, calculates dynamic position sizes, and halts trading if extreme volatility is detected.
*   **`/src/agent`**: The main orchestrator loop. It wires all the modules together and dictates the tick cycle of the agent.

## Setup

1. Copy `.env.example` to `.env` and fill in your keys (CMC, BSC RPC, Private Key).
2. Install dependencies: `npm install`
3. Run the agent: `npm start`

# Emotional Duality Strategy (EDI v2)

**A Cognitive Science-Based Trading Skill for the CoinMarketCap Ecosystem.**

## Overview
The Emotional Duality Strategy (EDI v2) is a highly specialized algorithmic trading skill that detects rare moments when crypto markets simultaneously hold opposing extreme emotions. Unlike traditional technical indicators that merely track price momentum, EDI v2 identifies regime shifts rooted in cognitive dissonance—specifically, when a sustained extreme in public sentiment is contradicted by real money positioning in derivatives markets.

## The Science
Traditional market theory assumes fear and greed are opposite ends of a single spectrum. However, applying the **Larsen & Cacioppo bivariate emotion model**, this strategy recognizes that complex systems (like crypto markets) can simultaneously exhibit both fear *and* greed. This contradiction is the core signal. When retail sentiment is extremely fearful but institutional funding rates are deeply positive (or vice versa), the market is experiencing cognitive dissonance—a state that precedes major reversals.

## How It Works
The Extreme Regime Disagreement (EDI v2) signal only fires when three simultaneous conditions are met:
1. **Sustained F&G Extremes**: The Fear & Greed index must be in the extreme zone (>75 or <25) AND have been there for ≥3 consecutive days.
2. **Funding Rate Confirmation**: The Binance funding rate must contradict the F&G sentiment (e.g., negative funding during extreme greed, indicating shorts are paying longs while retail is buying).
3. **Momentum Exhaustion**: Price momentum must show signs of stalling or divergence.

## Backtest Results
*EDI is a sniper, not a machine gun. It waits for perfect setups.*

| Asset | Win Rate | Trades | Total Return |
|-------|----------|--------|--------------|
| ETH   | 66.7%    | 3      | +0.72%       |
| BTC   | N/A      | 1      | -0.32%       |
| BNB   | N/A      | 0      | 0.00%        |

*Note: Results are based on default lookback windows and strict risk parameters (2% risk, 5% profit target, 3% stop loss, 14-day time stop).*

## Installation

```bash
# Clone the repository
git clone https://github.com/leobergjackson/BNB-hack-2026.git
cd emotional-duality-skill

# Create a virtual environment and install dependencies
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables
Create a `.env` file in the root directory:
```env
CMC_API_KEY=your_coinmarketcap_api_key_here
LUNARCRUSH_API_KEY=your_lunarcrush_api_key_here  # Optional
```

## Usage

This skill is designed to be executed via the CMC Skills Marketplace interface or programmatically:

```python
import asyncio
from emotional_duality_skill.cmc_skill import analyze

# Run the skill analysis
result = asyncio.run(analyze('BTC', lookback_days=365, include_backtest=True))
print(result)
```

## Architecture

```text
 APIs Data                 Core Engine                  Output
 +----------------+      +-------------------+      +------------------+
 | CMC API        |      | Data Clients      |      | CMC Skill Spec   |
 | Binance OHLCV  | ---> | (Normalize data)  | ---> |                  |
 | Alt.me F&G     |      +-------------------+      | - Signal State   |
 | LunarCrush     |                |                | - Evidence Pack  |
 +----------------+      +-------------------+      | - Backtest Metrics|
                         | EDI Signal Engine | ---> | - Market Regime  |
                         | (Compute Duality) |      +------------------+
                         +-------------------+
```

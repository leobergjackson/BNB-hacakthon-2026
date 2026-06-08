# Technical Architecture: Emotional Duality Index (EDI v2)

## Data Pipeline Architecture

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

## The Mathematical Conditions
The core logic resides in `core/edi_signal.py`. The strategy requires 3 stringent conditions to fire, governed by thresholds strictly defined in `config/defaults.py`:

1. **Sustained Sentiment Extremes**: Retail emotion must be completely saturated.
   - `FNG_EXTREME_GREED_THRESHOLD = 75`
   - `FNG_EXTREME_FEAR_THRESHOLD = 25`
   - `MIN_CONSECUTIVE_EXTREME_DAYS = 3`
2. **Funding Rate Contradiction**: The institutional/derivatives positioning must contradict retail sentiment. For example, if F&G > 75 (Greed), the Funding Rate must be negative (shorts paying longs).
3. **Momentum Exhaustion**: Moving averages must indicate that the current price trend is losing velocity, confirming the impending reversal.

## Strategic Data Sourcing
- **Alternative.me API**: Used for historical Fear & Greed data. Unlike other sources, it provides reliable, long-term historical endpoints required for the 365-day backtest engine.
- **Binance Public API**: Supplies high-fidelity OHLCV (price) and Funding Rate history. Crucial for detecting the "smart money" contradictions in the derivatives market.
- **CoinMarketCap API**: Utilized for real-time asset validation and live F&G indices.
- **LunarCrush API (Optional)**: Injected for auxiliary social sentiment tracking to boost signal confidence. 

### Graceful Degradation
To ensure production-grade reliability, the LunarCrush client handles HTTP 402 (Payment Required) or missing API keys natively. If the API key is missing or the endpoint throws an error, the client gracefully catches the exception and returns a neutral sentiment baseline of `50`. This ensures the core EDI algorithm never crashes due to external social data failures.

## Skill Execution & Output

The skill is exposed via the strictly typed `analyze()` callable in `cmc_skill.py`:

```python
async def analyze(symbol: str, lookback_days: int = 365, include_backtest: bool = True) -> dict:
    skill = EmotionalDualitySkill()
    return skill.generate_strategy_spec(symbol, lookback_days, risk_profile="balanced")
```

When invoked by an AI agent, it returns a machine-readable `evidence_pack`:

```json
{
  "status": "success",
  "resource": {
    "symbol": "BTC",
    "lookback_days": 365,
    "data_freshness": "2026-06-07T20:11:45"
  },
  "confidence": 0.85,
  "analysis": {
    "strategy_name": "Emotional Duality Strategy",
    "signal_name": "Extreme Regime Disagreement (EDI v2)",
    "entry_rules": "...",
    "position_sizing": "## Position Sizing\\n- **Risk per trade**: 2%..."
  },
  "backtest_results": {
    "total_return_pct": 0.0,
    "win_rate": 0,
    "max_drawdown_pct": 0.0
  },
  "signal_state": {
    "current_direction": "no_signal",
    "days_since_last_signal": 119
  }
}
```

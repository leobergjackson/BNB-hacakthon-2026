"""
Configuration defaults and magic numbers for the Emotional Duality Strategy.
"""

# Fear & Greed Thresholds
FNG_EXTREME_FEAR_THRESHOLD = 25
FNG_EXTREME_GREED_THRESHOLD = 75

# Signal Requirements
MIN_CONSECUTIVE_EXTREME_DAYS = 3

# Risk Management
PROFIT_TARGET_PCT = 0.05       # 5%
STOP_LOSS_PCT = 0.03           # 3%
TIME_STOP_DAYS = 14            # 14 days
RISK_PER_TRADE_PCT = 0.02      # 2%
MAX_POSITION_SIZE_PCT = 0.10   # 10%

# API Defaults
DEFAULT_LOOKBACK_DAYS = 365
DEFAULT_LUNARCRUSH_NEUTRAL = 50

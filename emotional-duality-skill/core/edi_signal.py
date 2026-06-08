from config.defaults import FNG_EXTREME_FEAR_THRESHOLD, FNG_EXTREME_GREED_THRESHOLD, MIN_CONSECUTIVE_EXTREME_DAYS
import numpy as np
import pandas as pd

def compute_edi_v2(fng_history: pd.Series, funding_history: pd.Series, price_history: pd.Series, social_sentiment: float = None) -> dict:
    """
    Computes the Emotional Duality Index v2 (EDI v2) - Extreme Regime Disagreement.
    Only fires when all three conditions (extreme F&G, contradictory positioning, and momentum exhaustion) are met.
    """
    # 1. Condition 1 - Sustained Extreme F&G
    regime = "none"
    regime_strength = 0
    fng_current = fng_history.iloc[-1]
    
    # Check extreme greed (>75) backwards
    consecutive_greed = 0
    for val in reversed(fng_history.values):
        if val > 75:
            consecutive_greed += 1
        else:
            break
            
    # Check extreme fear (<25) backwards
    consecutive_fear = 0
    for val in reversed(fng_history.values):
        if val < 25:
            consecutive_fear += 1
        else:
            break

    if consecutive_greed >= 3:
        regime = "extreme_greed"
        regime_strength = min(consecutive_greed, 14)
    elif consecutive_fear >= 3:
        regime = "extreme_fear"
        regime_strength = min(consecutive_fear, 14)

    # 2. Condition 2 - Positioning Contradicts Sentiment
    funding_3d_avg = funding_history.tail(3).mean()
    positioning_aligned = False
    positioning_strength = abs(funding_3d_avg) * 1000  # scale to comparable range
    
    if regime == "extreme_greed" and funding_3d_avg > 0.0001:  # 0.01%
        positioning_aligned = True
    elif regime == "extreme_fear" and funding_3d_avg < -0.00005:  # -0.005%
        positioning_aligned = True

    # 3. Condition 3 - Momentum Exhaustion
    current_7d_momentum = (price_history.iloc[-1] / price_history.iloc[-8]) - 1 if len(price_history) >= 8 else 0
    prev_7d_momentum = (price_history.iloc[-2] / price_history.iloc[-9]) - 1 if len(price_history) >= 9 else 0
    
    momentum_acceleration = current_7d_momentum - prev_7d_momentum
    exhaustion_detected = False
    
    if regime == "extreme_greed":
        # Momentum decelerating or negative
        if momentum_acceleration < 0 or current_7d_momentum < 0:
            exhaustion_detected = True
    elif regime == "extreme_fear":
        # Momentum accelerating (less negative) or positive
        if momentum_acceleration > 0 or current_7d_momentum > 0:
            exhaustion_detected = True

    # Compute EDI v2 Score
    edi_score = 0.0
    direction = "no_signal"
    confidence = 0.0
    
    if regime != "none" and positioning_aligned and exhaustion_detected:
        exhaustion_strength = min(abs(momentum_acceleration) / 0.05, 1.0)
        positioning_strength_normalized = min(positioning_strength / 0.2, 1.0) # approx normalizer
        
        edi_score = (regime_strength / 14.0 * 40.0) + (positioning_strength_normalized * 30.0) + (exhaustion_strength * 30.0)
        
        if regime == "extreme_greed":
            direction = "bearish_reversal"
        else:
            direction = "bullish_reversal"
            
        # Confidence calculation
        strong_conditions = 0
        if regime_strength > 7:
            strong_conditions += 1
        if positioning_strength_normalized > 0.75: # > 1.5x threshold heuristic
            strong_conditions += 1
        if exhaustion_detected:
            strong_conditions += 1
            
        if strong_conditions == 3:
            confidence = 0.9
        elif strong_conditions == 2:
            confidence = 0.65
        else:
            confidence = 0.4
            
    return {
        "edi_score": edi_score,
        "direction": direction,
        "regime": regime,
        "regime_strength_days": regime_strength,
        "positioning_aligned": positioning_aligned,
        "positioning_strength": funding_3d_avg,
        "exhaustion_detected": exhaustion_detected,
        "confidence": confidence,
        "components": {
            "fng_current": fng_current,
            "funding_3d_avg": funding_3d_avg,
            "momentum_7d": current_7d_momentum,
            "momentum_acceleration": momentum_acceleration,
        }
    }

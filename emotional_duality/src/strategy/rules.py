class StrategyRules:
    def __init__(self, risk_per_trade: float = 0.02):
        """
        risk_per_trade: max % of portfolio to risk on any single trade (default 2%)
        """
        self.risk_per_trade = risk_per_trade
    
    def entry_signal(self, edi_v2_output: dict, recent_price: float) -> dict:
        """
        Converts EDI v2 fire into a concrete entry order
        """
        if edi_v2_output["edi_score"] == 0:
            return {"type": "none"}
        
        if edi_v2_output["direction"] == "bullish_reversal":
            # Enter long on the fire day at close
            return {
                "type": "long",
                "trigger_price": recent_price,
                "entry_logic": f"EDI v2 bullish reversal fired (confidence: {edi_v2_output['confidence']:.1%})",
                "confidence": edi_v2_output["confidence"],
            }
        elif edi_v2_output["direction"] == "bearish_reversal":
            # Enter short on the fire day at close
            return {
                "type": "short",
                "trigger_price": recent_price,
                "entry_logic": f"EDI v2 bearish reversal fired (confidence: {edi_v2_output['confidence']:.1%})",
                "confidence": edi_v2_output["confidence"],
            }
        
        return {"type": "none"}
    
    def exit_signal(self, position: dict, current_price: float, days_held: int) -> dict:
        """
        Exits a position based on profit target or time stop
        """
        if position is None:
            return {"exit": False}
        
        pos_type = position["type"]
        entry_price = position["entry_price"]
        
        # EXIT RULE 1: Profit target
        if pos_type == "long" and current_price >= entry_price * 1.05:
            return {"exit": True, "reason": "profit_target_5pct"}
        elif pos_type == "short" and current_price <= entry_price * 0.95:
            return {"exit": True, "reason": "profit_target_5pct"}
        
        # EXIT RULE 2: Time stop
        if days_held >= 14:
            return {"exit": True, "reason": "time_stop_14d"}
        
        # EXIT RULE 3: Stop loss
        if pos_type == "long" and current_price <= entry_price * 0.97:
            return {"exit": True, "reason": "stop_loss_3pct"}
        elif pos_type == "short" and current_price >= entry_price * 1.03:
            return {"exit": True, "reason": "stop_loss_3pct"}
        
        return {"exit": False}

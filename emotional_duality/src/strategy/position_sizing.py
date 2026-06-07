class PositionSizing:
    def __init__(self, risk_per_trade: float = 0.02, max_position_size: float = 0.10):
        """
        risk_per_trade: % of capital to risk per trade (default 2%)
        max_position_size: max % of capital in any one position (default 10%)
        """
        self.risk_per_trade = risk_per_trade
        self.max_position_size = max_position_size
    
    def calculate_position_size(
        self,
        portfolio_value: float,
        entry_price: float,
        stop_loss_price: float,
    ) -> dict:
        """
        Kelly-style position sizing based on risk/reward
        """
        # Risk per trade in dollars
        risk_dollars = portfolio_value * self.risk_per_trade
        
        # Distance to stop loss
        if entry_price == stop_loss_price:
            stop_distance_pct = 0.03  # fallback to 3%
        else:
            stop_distance_pct = abs(entry_price - stop_loss_price) / entry_price
        
        # Calculate quantity: how many units can we buy with our risk budget?
        quantity = risk_dollars / (entry_price * stop_distance_pct)
        
        # Cap position size
        notional_usd = quantity * entry_price
        max_notional = portfolio_value * self.max_position_size
        
        if notional_usd > max_notional:
            quantity = max_notional / entry_price
        
        notional_usd = quantity * entry_price
        risk_amount = quantity * abs(entry_price - stop_loss_price)
        
        # Assume 5% profit target
        reward_target = quantity * abs(entry_price * 1.05 - entry_price)
        
        return {
            "quantity": quantity,
            "notional_usd": notional_usd,
            "risk_amount": risk_amount,
            "reward_target": reward_target,
        }

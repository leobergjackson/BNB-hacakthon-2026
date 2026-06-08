import pandas as pd
import numpy as np
from config.defaults import PROFIT_TARGET_PCT, STOP_LOSS_PCT, TIME_STOP_DAYS, RISK_PER_TRADE_PCT, MAX_POSITION_SIZE_PCT

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



class PortfolioSimulator:
    def __init__(self, initial_capital: float, strategy_rules, position_sizing):
        self.initial_capital = initial_capital
        self.current_capital = initial_capital
        self.strategy_rules = strategy_rules
        self.position_sizing = position_sizing
        
        # Tracking
        self.positions = [] 
        self.equity_curve = []
        self.trades = []
    
    def backtest(self, symbol: str, price_history: pd.DataFrame, edi_history: pd.DataFrame) -> dict:
        """
        Run full backtest
        """
        df = price_history.merge(edi_history, on='date', how='left')
        df['edi_score'] = df['edi_score'].fillna(0)
        df = df.sort_values('date').reset_index(drop=True)
        
        active_position = None
        position_entry_idx = None
        
        daily_values = []
        
        for idx, row in df.iterrows():
            date = row['date']
            close = row['close']
            edi_v2_out = {
                'edi_score': row['edi_score'],
                'direction': row.get('edi_direction', 'none'),
                'confidence': row.get('confidence', 0),
            }
            
            # Check if active position should exit
            if active_position:
                days_held = idx - position_entry_idx
                exit_signal = self.strategy_rules.exit_signal(active_position, close, days_held)
                
                if exit_signal["exit"]:
                    entry_price = active_position['entry_price']
                    quantity = active_position['quantity']
                    
                    if active_position['type'] == 'long':
                        pnl = (close - entry_price) * quantity
                        principal = entry_price * quantity
                    else:  # short
                        pnl = (entry_price - close) * quantity
                        principal = entry_price * quantity
                    
                    self.current_capital += (principal + pnl)
                    
                    self.trades.append({
                        'entry_date': df.iloc[position_entry_idx]['date'],
                        'entry_price': entry_price,
                        'exit_date': date,
                        'exit_price': close,
                        'type': active_position['type'],
                        'quantity': quantity,
                        'pnl_dollars': pnl,
                        'pnl_percent': pnl / (entry_price * quantity),
                        'reason': exit_signal['reason'],
                    })
                    
                    active_position = None
                    position_entry_idx = None
            
            # Check for new entry signal
            if active_position is None and edi_v2_out['edi_score'] > 0:
                entry_sig = self.strategy_rules.entry_signal(edi_v2_out, close)
                
                if entry_sig['type'] != 'none':
                    size = self.position_sizing.calculate_position_size(
                        self.current_capital,
                        close,
                        close * 0.97 if entry_sig['type'] == 'long' else close * 1.03,
                    )
                    
                    notional = size['notional_usd']
                    if notional <= self.current_capital:
                        self.current_capital -= notional
                        active_position = {
                            'entry_price': close,
                            'quantity': size['quantity'],
                            'type': entry_sig['type'],
                        }
                        position_entry_idx = idx
            
            # Calculate daily portfolio value
            unrealized = 0
            if active_position:
                if active_position['type'] == 'long':
                    unrealized = (close - active_position['entry_price']) * active_position['quantity']
                else:
                    unrealized = (active_position['entry_price'] - close) * active_position['quantity']
            
            portfolio_value = self.current_capital + unrealized
            daily_values.append({'date': date, 'value': portfolio_value})
        
        # Close any remaining position at last price
        if active_position:
            last_price = df.iloc[-1]['close']
            principal = active_position['entry_price'] * active_position['quantity']
            if active_position['type'] == 'long':
                pnl = (last_price - active_position['entry_price']) * active_position['quantity']
            else:
                pnl = (active_position['entry_price'] - last_price) * active_position['quantity']
            
            self.current_capital += (principal + pnl)
            self.trades.append({
                'entry_date': df.iloc[position_entry_idx]['date'],
                'entry_price': active_position['entry_price'],
                'exit_date': df.iloc[-1]['date'],
                'exit_price': last_price,
                'type': active_position['type'],
                'quantity': active_position['quantity'],
                'pnl_dollars': pnl,
                'pnl_percent': pnl / (active_position['entry_price'] * active_position['quantity']),
                'reason': 'backtest_end',
            })
        
        # Compute metrics
        equity_df = pd.DataFrame(daily_values)
        equity_df['returns'] = equity_df['value'].pct_change()
        
        total_return = (self.current_capital - self.initial_capital) / self.initial_capital
        sharpe_ratio = equity_df['returns'].mean() / equity_df['returns'].std() * np.sqrt(252) if len(equity_df) > 1 and equity_df['returns'].std() != 0 else 0
        
        peak = equity_df['value'].expanding().max()
        drawdown = (equity_df['value'] - peak) / peak
        max_drawdown = drawdown.min()
        
        trades_df = pd.DataFrame(self.trades)
        if not trades_df.empty:
            winners = trades_df[trades_df['pnl_dollars'] > 0]
            losers = trades_df[trades_df['pnl_dollars'] <= 0]
            
            win_rate = len(winners) / len(trades_df)
            avg_winner = winners['pnl_dollars'].mean() if len(winners) > 0 else 0
            avg_loser = losers['pnl_dollars'].mean() if len(losers) > 0 else 0
            profit_factor = abs(winners['pnl_dollars'].sum() / losers['pnl_dollars'].sum()) if len(losers) > 0 and losers['pnl_dollars'].sum() != 0 else 0
        else:
            win_rate = avg_winner = avg_loser = profit_factor = 0
            
        return {
            'total_return_pct': total_return * 100,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown_pct': max_drawdown * 100,
            'win_rate': win_rate,
            'total_trades': len(self.trades),
            'avg_winner': avg_winner,
            'avg_loser': avg_loser,
            'profit_factor': profit_factor,
            'equity_curve': equity_df,
            'trades': self.trades,
        }



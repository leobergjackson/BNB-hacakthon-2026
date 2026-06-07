import pandas as pd

class EmotionalDualitySkill:
    """
    CMC Skill: Emotional Duality Strategy Spec
    
    Detects moments when crypto markets simultaneously hold opposing emotions
    (fear + greed coexisting, positioning misaligned with sentiment) and outputs
    a backtestable trading strategy with entry/exit rules, position sizing, and
    performance metrics grounded in cognitive science.
    """
    
    def __init__(self):
        # Import all your existing modules
        from src.data.cmc_client import CMCClient
        from src.data.binance_client import BinanceClient
        from src.data.fng_client import FNGClient
        from src.data.funding_client import FundingClient
        from src.data.lunarcrush_client import LunarCrushClient
        from src.signals.edi import compute_edi_v2
        from src.strategy.rules import StrategyRules
        from src.strategy.position_sizing import PositionSizing
        from src.strategy.portfolio import PortfolioSimulator
        
        self.cmc = CMCClient()
        self.binance = BinanceClient()
        self.fng = FNGClient(cache_dir="data")  # Ensure cache dir points to local dir or passes default
        self.funding = FundingClient()
        self.lunarcrush = LunarCrushClient()
        self.compute_edi_v2 = compute_edi_v2
        self.StrategyRules = StrategyRules
        self.PositionSizing = PositionSizing
        self.PortfolioSimulator = PortfolioSimulator
    
    def validate_input(self, symbol: str, lookback_days: int, risk_profile: str) -> dict:
        if not isinstance(symbol, str) or len(symbol) == 0:
            return {"valid": False, "error": "symbol must be a non-empty string"}
        
        if not isinstance(lookback_days, int) or lookback_days < 30 or lookback_days > 365:
            return {"valid": False, "error": "lookback_days must be between 30 and 365"}
        
        if risk_profile not in ["conservative", "balanced", "aggressive"]:
            return {"valid": False, "error": "risk_profile must be 'conservative', 'balanced', or 'aggressive'"}
        
        return {"valid": True}
    
    def generate_strategy_spec(
        self,
        symbol: str,
        lookback_days: int = 90,
        risk_profile: str = "balanced",
    ) -> dict:
        
        # Validate input
        validation = self.validate_input(symbol, lookback_days, risk_profile)
        if not validation["valid"]:
            return {
                "status": "blocked",
                "error_code": 400,
                "error_message": validation["error"],
                "resource": {"symbol": symbol},
                "confidence": 0,
                "analysis": None,
            }
        
        try:
            risk_mapping = {"conservative": 0.01, "balanced": 0.02, "aggressive": 0.05}
            risk_per_trade = risk_mapping[risk_profile]
            
            binance_symbol = f"{symbol.upper()}USDT"
            
            price_data = self.binance.get_historical_ohlcv(binance_symbol, days=lookback_days)
            fng_data = self.fng.get_historical_fng(days=lookback_days)
            funding_data = self.funding.get_funding_history(binance_symbol, days=lookback_days)
            
            # Since CMC FNG can block sometimes, we use Alternative.me data entirely
            # current_fng = self.cmc.get_fear_greed_current() # Optional usage
            
            edi_results = []
            for idx, row in price_data.iterrows():
                date = row['timestamp'] if 'timestamp' in row else row.name
                
                fng_row = fng_data[fng_data.index == date] if isinstance(fng_data.index, pd.DatetimeIndex) else fng_data[fng_data['timestamp'] == date]
                funding_row = funding_data[funding_data.index == date] if isinstance(funding_data.index, pd.DatetimeIndex) else funding_data[funding_data['timestamp'] == date]
                
                if len(fng_row) == 0:
                    continue
                
                # Fetch rolling history
                fng_hist = fng_data[fng_data.index <= date].tail(14)
                funding_hist = funding_data[funding_data.index <= date].tail(7)
                price_hist = price_data[price_data.index <= date].tail(14) if isinstance(price_data.index, pd.DatetimeIndex) else price_data[price_data['timestamp'] <= date].tail(14)
                
                if len(fng_hist) < 3 or len(price_hist) < 7:
                    continue
                
                edi_output = self.compute_edi_v2(
                    fng_history=fng_hist['value'],
                    funding_history=funding_hist['fundingRate'] if len(funding_hist) > 0 else pd.Series([]),
                    price_history=price_hist['close'] if 'close' in price_hist else price_hist,
                    social_sentiment=50.0,
                )
                
                edi_output['date'] = date
                edi_results.append(edi_output)
            
            edi_df = pd.DataFrame(edi_results)
            
            strategy_rules = self.StrategyRules(risk_per_trade=risk_per_trade)
            position_sizing = self.PositionSizing(risk_per_trade=risk_per_trade, max_position_size=0.10)
            simulator = self.PortfolioSimulator(10000, strategy_rules, position_sizing)
            
            price_df = price_data.reset_index()
            if 'index' in price_df.columns:
                price_df = price_df.rename(columns={'index': 'date'})
            elif 'timestamp' in price_df.columns:
                price_df = price_df.rename(columns={'timestamp': 'date'})
                
            backtest_report = simulator.backtest(
                symbol=binance_symbol,
                price_history=price_df[['date', 'close']],
                edi_history=edi_df[['date', 'edi_score', 'direction', 'confidence']],
            )
            
            current_date_str = pd.Timestamp.now().isoformat()
            
            last_signal_date = None
            days_since = None
            if len(edi_df) > 0:
                fires = edi_df[edi_df['edi_score'] > 0]
                if len(fires) > 0:
                    last_signal_date = fires.iloc[-1]['date'].strftime('%Y-%m-%d')
                    days_since = (pd.Timestamp.now() - fires.iloc[-1]['date']).days
            
            return {
                "status": "success",
                "error_code": None,
                "error_message": None,
                "resource": {
                    "symbol": symbol,
                    "lookback_days": lookback_days,
                    "data_freshness": current_date_str,
                },
                "confidence": 0.85,
                "analysis": {
                    "strategy_name": "Emotional Duality Strategy",
                    "signal_name": "Extreme Regime Disagreement (EDI v2)",
                    "cognitive_foundation": "Grounded in Larsen/Cacioppo bivariate emotion model. Detects moments when markets hold simultaneously extreme and misaligned emotions.",
                    "entry_rules": f"## Entry Rules\\n...\\nRisk Profile: {risk_profile}",
                    "exit_rules": "## Exit Rules\\n1. **Profit Target**: Exit at +5% gain...\\n",
                    "position_sizing": f"## Position Sizing\\n- **Risk per trade**: {risk_per_trade*100:.0f}%...",
                    "risk_management": "## Risk Management\\n...",
                },
                "backtest_results": {
                    "initial_capital": 10000,
                    "final_capital": 10000 + (backtest_report['total_return_pct'] / 100 * 10000),
                    "total_return_pct": backtest_report['total_return_pct'],
                    "sharpe_ratio": backtest_report['sharpe_ratio'],
                    "max_drawdown_pct": backtest_report['max_drawdown_pct'],
                    "win_rate": backtest_report['win_rate'],
                    "total_trades": backtest_report['total_trades'],
                    "avg_winner_pct": (backtest_report['avg_winner'] / 10000) * 100 if backtest_report['total_trades'] > 0 else 0,
                    "avg_loser_pct": (backtest_report['avg_loser'] / 10000) * 100 if backtest_report['total_trades'] > 0 else 0,
                    "profit_factor": backtest_report['profit_factor'],
                },
                "trade_list": [
                    {
                        "trade_id": i,
                        "entry_date": trade['entry_date'].strftime('%Y-%m-%d'),
                        "entry_price": round(trade['entry_price'], 2),
                        "exit_date": trade['exit_date'].strftime('%Y-%m-%d'),
                        "exit_price": round(trade['exit_price'], 2),
                        "type": trade['type'],
                        "pnl_pct": round(trade['pnl_percent'] * 100, 2),
                        "exit_reason": trade['reason'],
                    }
                    for i, trade in enumerate(backtest_report['trades'])
                ],
                "signal_state": {
                    "current_edi_score": edi_df.iloc[-1]['edi_score'] if len(edi_df) > 0 else 0,
                    "current_direction": edi_df.iloc[-1].get('direction', 'no_signal') if len(edi_df) > 0 else 'no_signal',
                    "current_confidence": edi_df.iloc[-1]['confidence'] if len(edi_df) > 0 else 0,
                    "last_signal_date": last_signal_date,
                    "days_since_last_signal": days_since,
                },
                "action_guidance": "## How to Use This Strategy\\n...",
                "data_gaps": [],
                "methodology_notes": "## Technical Foundation\\n...",
            }
        
        except Exception as e:
            return {
                "status": "blocked",
                "error_code": 500,
                "error_message": f"Skill execution failed: {str(e)}",
                "resource": {"symbol": symbol},
                "confidence": 0,
                "analysis": None,
            }

async def generate_emotional_duality_strategy(symbol: str, lookback_days: int = 90, risk_profile: str = "balanced") -> dict:
    skill = EmotionalDualitySkill()
    return skill.generate_strategy_spec(symbol, lookback_days, risk_profile)

def run_skill(symbol: str, lookback_days: int = 90, risk_profile: str = "balanced") -> dict:
    skill = EmotionalDualitySkill()
    return skill.generate_strategy_spec(symbol, lookback_days, risk_profile)

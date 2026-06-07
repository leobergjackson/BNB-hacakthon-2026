import sys
import os
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from src.skill.cmc_skill import run_skill

result = run_skill("BTC", lookback_days=90, risk_profile="balanced")
print(result["status"])
if result["status"] == "success":
    print(result["analysis"]["strategy_name"])
    print(f"Return: {result['backtest_results']['total_return_pct']:.2f}%")
else:
    print(result.get("error_message"))

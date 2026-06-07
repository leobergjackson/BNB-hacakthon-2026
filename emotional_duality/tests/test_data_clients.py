import pytest
import os
import sys

# Ensure src is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.data.binance_client import BinanceClient
from src.data.fng_client import FNGClient
from src.data.funding_client import FundingClient

def test_binance_client_klines():
    client = BinanceClient()
    df = client.get_klines("BTCUSDT", "1d", limit=5)
    assert not df.empty
    assert len(df) == 5
    assert "close" in df.columns

def test_fng_client():
    cache_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
        
    client = FNGClient(cache_dir=cache_dir)
    df = client.get_historical_fng(days=5)
    assert not df.empty
    assert len(df) == 5
    assert "value" in df.columns

def test_funding_client():
    client = FundingClient()
    df = client.get_funding_history("BTCUSDT", days=5)
    assert not df.empty
    assert "fundingRate" in df.columns

import os
import requests
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time

logger = logging.getLogger(__name__)


class BinanceClient:
    BASE_URL = "https://api.binance.com/api/v3"

    def get_klines(self, symbol, interval, limit=1000, start_time=None, end_time=None):
        endpoint = "/klines"
        url = f"{self.BASE_URL}{endpoint}"
        params = {
            "symbol": symbol,
            "interval": interval,
            "limit": limit
        }
        if start_time:
            params["startTime"] = start_time
        if end_time:
            params["endTime"] = end_time

        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        df = pd.DataFrame(data, columns=[
            "timestamp", "open", "high", "low", "close", "volume", 
            "close_time", "quote_asset_volume", "number_of_trades", 
            "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume", "ignore"
        ])
        
        df = df[["timestamp", "open", "high", "low", "close", "volume"]]
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit='ms')
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype(float)
            
        return df

    def get_historical_ohlcv(self, symbol, days=90, interval="1d"):
        limit = 1000
        end_time = int(time.time() * 1000)
        
        # Calculate milliseconds in the given interval
        # For simplicity, handle popular daily/hourly intervals
        if interval == "1d":
            ms_per_interval = 24 * 60 * 60 * 1000
            total_intervals = days
        elif interval == "4h":
            ms_per_interval = 4 * 60 * 60 * 1000
            total_intervals = days * 6
        elif interval == "1h":
            ms_per_interval = 60 * 60 * 1000
            total_intervals = days * 24
        else:
            raise ValueError(f"Unsupported interval: {interval}")

        start_time = end_time - (total_intervals * ms_per_interval)
        
        all_dfs = []
        current_start = start_time
        
        while current_start < end_time:
            df = self.get_klines(symbol, interval, limit=limit, start_time=current_start, end_time=end_time)
            if df.empty:
                break
            all_dfs.append(df)
            
            # Update start time to the last timestamp + 1 ms to fetch next batch
            last_timestamp = int(df.iloc[-1]["timestamp"].timestamp() * 1000)
            if current_start == last_timestamp + 1:
                break
            current_start = last_timestamp + 1
            time.sleep(0.1) # Be nice to the API

        if not all_dfs:
            return pd.DataFrame()
            
        final_df = pd.concat(all_dfs, ignore_index=True)
        final_df.drop_duplicates(subset=['timestamp'], inplace=True)
        final_df.set_index("timestamp", inplace=True)
        final_df.sort_index(inplace=True)
        return final_df.tail(total_intervals) # Trim any excess




class CMCClient:
    BASE_URL = "https://pro-api.coinmarketcap.com"

    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("CMC_API_KEY")
        if not self.api_key:
            logger.warning("CMC_API_KEY is not set. API calls will fail.")
        self.headers = {
            "Accepts": "application/json",
            "X-CMC_PRO_API_KEY": self.api_key,
        }

    def _request(self, endpoint, params=None):
        url = f"{self.BASE_URL}{endpoint}"
        retries = 3
        backoff = 2

        for i in range(retries):
            response = requests.get(url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                logger.warning(f"Rate limited. Retrying in {backoff} seconds...")
                time.sleep(backoff)
                backoff *= 2
            elif response.status_code == 401:
                raise Exception("Unauthorized: Invalid CMC_API_KEY")
            else:
                response.raise_for_status()
                
        raise Exception("Max retries exceeded for CMC API")

    def get_fear_greed_current(self):
        data = self._request("/v3/fear-and-greed/latest")
        fng_data = data["data"]
        return {
            "value": fng_data["value"],
            "classification": fng_data["value_classification"],
            "timestamp": fng_data["update_time"]
        }

    def get_quotes_latest(self, symbols: list):
        params = {"symbol": ",".join(symbols)}
        data = self._request("/v2/cryptocurrency/quotes/latest", params)
        results = {}
        for sym in symbols:
            if sym in data["data"]:
                token_data = data["data"][sym][0]
                quote = token_data["quote"]["USD"]
                results[sym] = {
                    "price": quote["price"],
                    "volume_24h": quote["volume_24h"],
                    "percent_change_24h": quote["percent_change_24h"]
                }
        return results

    def get_global_metrics(self):
        data = self._request("/v1/global-metrics/quotes/latest")
        quote = data["data"]["quote"]["USD"]
        return {
            "btc_dominance": data["data"]["btc_dominance"],
            "total_market_cap": quote["total_market_cap"]
        }



class FNGClient:
    URL = "https://api.alternative.me/fng/?limit=0"

    def __init__(self, cache_dir):
        self.cache_dir = cache_dir
        self.cache_file = os.path.join(cache_dir, "fng_history.csv")

    def get_historical_fng(self, days=None):
        # Check cache if days is None (we want full history) or if cache exists and is fresh
        if os.path.exists(self.cache_file):
            file_mtime = os.path.getmtime(self.cache_file)
            if time.time() - file_mtime < 3600: # Cache valid for 1 hour
                df = pd.read_csv(self.cache_file, parse_dates=['timestamp'], index_col='timestamp')
                if days:
                    return df.tail(days)
                return df

        response = requests.get(self.URL)
        response.raise_for_status()
        data = response.json()

        df = pd.DataFrame(data["data"])
        df["timestamp"] = pd.to_datetime(df["timestamp"].astype(int), unit='s')
        df["value"] = df["value"].astype(float)
        
        # Select relevant columns
        df = df[["timestamp", "value", "value_classification"]]
        df.rename(columns={"value_classification": "classification"}, inplace=True)
        
        # Sort chronologically (API returns newest first)
        df.sort_values(by="timestamp", inplace=True)
        df.set_index("timestamp", inplace=True)

        # Save to cache
        if self.cache_dir and os.path.exists(self.cache_dir):
            df.to_csv(self.cache_file)

        if days:
            return df.tail(days)
        return df



class FundingClient:
    BASE_URL = "https://fapi.binance.com"

    def get_funding_history(self, symbol, days=90):
        # fapi funding rate limit is 1000 per request, each is 8 hours, 
        # 1000 * 8h = 8000 hours > 300 days. One request is enough.
        limit = 1000
        ms_per_day = 24 * 60 * 60 * 1000
        start_time = int((time.time() * 1000) - (days * ms_per_day))
        
        url = f"{self.BASE_URL}/fapi/v1/fundingRate"
        params = {
            "symbol": symbol,
            "startTime": start_time,
            "limit": limit
        }

        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        df = pd.DataFrame(data)
        if df.empty:
            return pd.DataFrame(columns=["timestamp", "fundingRate"]).set_index("timestamp")

        df["timestamp"] = pd.to_datetime(df["fundingTime"], unit='ms')
        df["fundingRate"] = df["fundingRate"].astype(float)
        
        df = df[["timestamp", "fundingRate"]]
        df.set_index("timestamp", inplace=True)
        df.sort_index(inplace=True)
        
        # Resample to daily (mean funding rate for the day)
        daily_df = df.resample('1D').mean()
        return daily_df

    def get_open_interest_history(self, symbol, period="1d", limit=90):
        url = f"{self.BASE_URL}/futures/data/openInterestHist"
        params = {
            "symbol": symbol,
            "period": period,
            "limit": limit
        }

        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        df = pd.DataFrame(data)
        if df.empty:
            return pd.DataFrame()

        df["timestamp"] = pd.to_datetime(df["timestamp"], unit='ms')
        df["sumOpenInterest"] = df["sumOpenInterest"].astype(float)
        df["sumOpenInterestValue"] = df["sumOpenInterestValue"].astype(float)
        
        df = df[["timestamp", "sumOpenInterest", "sumOpenInterestValue"]]
        df.set_index("timestamp", inplace=True)
        df.sort_index(inplace=True)
        return df




class LunarCrushClient:
    BASE_URL = "https://lunarcrush.com/api4/public"
    SYMBOL_TO_SLUG = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "BNB": "binancecoin",
        "SOL": "solana",
        "DOGE": "dogecoin",
        "ADA": "cardano",
        "XRP": "xrp",
        "AVAX": "avalanche",
        "LINK": "chainlink",
        "DOT": "polkadot",
    }

    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("LUNARCRUSH_API_KEY")
        if not self.api_key:
            logger.warning("LUNARCRUSH_API_KEY is not set. Social metrics will default to None.")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}" if self.api_key else ""
        }

    def _get_slug(self, symbol):
        # Remove common quote currencies like USDT if present
        base_symbol = symbol.replace("USDT", "").replace("USD", "").upper()
        return self.SYMBOL_TO_SLUG.get(base_symbol, base_symbol.lower())

    def get_social_metrics(self, symbol):
        if not self.api_key:
            return None
            
        slug = self._get_slug(symbol)
        url = f"{self.BASE_URL}/coins/{slug}/v1"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            if "data" in data and len(data["data"]) > 0:
                coin_data = data["data"][0] if isinstance(data["data"], list) else data["data"]
                return {
                    "social_score": coin_data.get("social_score", 50),
                    "sentiment": coin_data.get("sentiment", 50),
                    "social_volume_24h": coin_data.get("social_volume", 0)
                }
            return None
        except Exception as e:
            logger.error(f"Error fetching LunarCrush data for {slug}: {e}")
            return None

    def get_historical_social(self, symbol, days=90):
        if not self.api_key:
            return pd.DataFrame()
            
        slug = self._get_slug(symbol)
        url_v2 = f"{self.BASE_URL}/coins/{slug}/time-series/v2"
        url_v1 = f"{self.BASE_URL}/coins/{slug}/time-series/v1"
        
        params = {
            "interval": "1d",
            "limit": days
        }
        
        try:
            response = requests.get(url_v2, headers=self.headers, params=params)
            if response.status_code == 404:
                # Fallback to v1
                response = requests.get(url_v1, headers=self.headers, params=params)
                
            response.raise_for_status()
            data = response.json()
            
            if "data" in data and len(data["data"]) > 0:
                df = pd.DataFrame(data["data"])
                if "time" in df.columns:
                    df["timestamp"] = pd.to_datetime(df["time"], unit='s')
                    df.set_index("timestamp", inplace=True)
                    df.sort_index(inplace=True)
                    return df
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"Error fetching historical LunarCrush data for {slug}: {e}")
            return pd.DataFrame()



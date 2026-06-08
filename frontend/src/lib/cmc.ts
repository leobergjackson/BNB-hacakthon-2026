import { generateDemoCandles } from "./sample-data";
import { AssetSymbol, MarketCandle, MarketDataset, StrategyRequest, Timeframe } from "./types";

const CMC_IDS: Record<AssetSymbol, string> = {
  BTC: "1",
  ETH: "1027",
  BNB: "1839",
  SOL: "5426"
};

const CMC_ENDPOINT = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/historical";

interface CmcQuote {
  time_open?: string;
  time_close?: string;
  quote?: {
    USD?: {
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      volume?: number;
      timestamp?: string;
    };
  };
}

interface CmcDataBlock {
  quotes?: CmcQuote[];
}

export async function loadMarketDataset(request: StrategyRequest): Promise<MarketDataset> {
  const apiKey = process.env.CMC_PRO_API_KEY;

  if (!apiKey) {
    return demoDataset(request, "CMC_PRO_API_KEY is not configured.");
  }

  try {
    const url = buildCmcUrl(request);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": apiKey
      },
      next: { revalidate: 900 }
    });

    if (!response.ok) {
      return demoDataset(request, `CoinMarketCap returned HTTP ${response.status}.`);
    }

    const payload = await response.json();
    const quotes = extractQuotes(payload?.data);

    const candles = dropActivePeriod(parseCmcCandles(quotes), request.lookbackBars);
    if (candles.length < 80) {
      return demoDataset(request, "CoinMarketCap response did not include enough OHLCV candles.");
    }

    return {
      source: "coinmarketcap",
      sourceLabel: "CoinMarketCap Pro API",
      endpoint: CMC_ENDPOINT,
      candles
    };
  } catch (error) {
    return demoDataset(request, error instanceof Error ? error.message : "Unknown CoinMarketCap fetch error.");
  }
}

function extractQuotes(data: unknown): CmcQuote[] | undefined {
  if (Array.isArray(data)) {
    return (data[0] as CmcDataBlock | undefined)?.quotes;
  }

  if (isCmcDataBlock(data)) {
    return data.quotes;
  }

  if (data && typeof data === "object") {
    const firstValue = Object.values(data)[0];
    if (isCmcDataBlock(firstValue)) {
      return firstValue.quotes;
    }
  }

  return undefined;
}

function isCmcDataBlock(value: unknown): value is CmcDataBlock {
  return Boolean(value && typeof value === "object" && "quotes" in value);
}

function buildCmcUrl(request: StrategyRequest): string {
  const url = new URL(CMC_ENDPOINT);
  url.searchParams.set("id", CMC_IDS[request.asset]);
  url.searchParams.set("time_period", request.timeframe === "1d" ? "daily" : "hourly");
  url.searchParams.set("interval", intervalFor(request.timeframe));
  url.searchParams.set("count", String(request.lookbackBars + 1));
  url.searchParams.set("convert", "USD");
  return url.toString();
}

function dropActivePeriod(candles: MarketCandle[], requestedBars: number): MarketCandle[] {
  if (candles.length <= requestedBars) return candles;
  return candles.slice(0, requestedBars);
}

function intervalFor(timeframe: Timeframe): string {
  if (timeframe === "1h") return "1h";
  if (timeframe === "4h") return "4h";
  return "daily";
}

function parseCmcCandles(quotes: CmcQuote[] | undefined): MarketCandle[] {
  if (!quotes) return [];

  return quotes
    .map((item) => {
      const quote = item.quote?.USD;
      if (!quote) return null;
      const time = item.time_open ?? item.time_close ?? quote.timestamp;
      if (!time) return null;
      if (item.time_close && Date.parse(item.time_close) > Date.now()) return null;

      return {
        time,
        open: Number(quote.open),
        high: Number(quote.high),
        low: Number(quote.low),
        close: Number(quote.close),
        volume: Number(quote.volume ?? 0)
      };
    })
    .filter((candle): candle is MarketCandle =>
      Boolean(
        candle &&
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close)
      )
    )
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function demoDataset(request: StrategyRequest, fallbackReason: string): MarketDataset {
  return {
    source: "demo",
    sourceLabel: "Deterministic demo OHLCV",
    endpoint: CMC_ENDPOINT,
    fallbackReason,
    candles: generateDemoCandles(request.asset, request.timeframe, request.lookbackBars)
  };
}

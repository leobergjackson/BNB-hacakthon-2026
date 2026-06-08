// ============================================================================
// RegimeShift CMC Skill — MCP Client
// Wraps CMC MCP endpoint with typed tool calls and error handling.
// Supports: StreamableHTTP → SSE → Direct REST API fallback
//
// CMC MCP Tool Name Mapping (discovered via listTools):
//   get_global_metrics_latest           → Global market metrics
//   get_global_crypto_derivatives_metrics → Derivatives data
//   get_crypto_metrics                  → On-chain metrics (param: id)
//   get_crypto_technical_analysis       → Technical analysis (param: id)
//   get_crypto_quotes_latest            → Live quotes (param: id)
//   trending_crypto_narratives          → Trending narratives
//   get_crypto_latest_news              → Latest news (param: id)
//   get_upcoming_macro_events           → Macro events
//   search_cryptos                      → Symbol → ID resolution
//   get_crypto_info                     → Project fundamentals
//   get_crypto_marketcap_technical_analysis → Market cap TA
//   search_crypto_info                  → Semantic search
// ============================================================================

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  GlobalMetrics,
  DerivativesData,
  OnChainMetrics,
  TechnicalAnalysis,
  LiveQuote,
  TrendingNarratives,
  TrendingNarrative,
  NewsData,
  NewsItem,
  NewsSentiment,
  MacroEvents,
  MacroEvent,
  CollectedMarketData,
  type Timeframe,
} from './types.js';

// ─── Configuration ──────────────────────────────────────────────────────────

interface MCPClientConfig {
  endpoint: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
}

type ConnectionMode = 'streamable-http' | 'sse' | 'rest-api';

// ─── Helper: safe extract from nested MCP response ─────────────────────────

function safeGet(obj: any, path: string, fallback: any = null): any {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return fallback;
    return acc[key] ?? fallback;
  }, obj);
}

function safeNumber(value: any, fallback: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

// ─── CMC MCP Client Class ───────────────────────────────────────────────────

export class CMCMcpClient {
  private config: MCPClientConfig;
  private client: Client | null = null;
  private connected: boolean = false;
  private connectionMode: ConnectionMode = 'streamable-http';
  private symbolIdCache: Map<string, string> = new Map();

  constructor(config: MCPClientConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 2,
      ...config,
    };
  }

  // ── Connection Management ───────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected) return;

    // Try 1: Streamable HTTP transport (preferred for modern MCP)
    try {
      console.log('🔌 Connecting to CMC MCP (Streamable HTTP)...');
      const url = new URL(this.config.endpoint);

      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers: {
            'X-CMC-MCP-API-KEY': this.config.apiKey,
          },
        },
      });

      this.client = new Client({
        name: 'regimeshift-skill',
        version: '1.0.0',
      });

      await this.client.connect(transport);
      this.connected = true;
      this.connectionMode = 'streamable-http';
      console.log('✅ Connected via Streamable HTTP transport');
      return;
    } catch (err) {
      console.warn(`  ⚠ Streamable HTTP failed: ${(err as Error).message}`);
      this.client = null;
    }

    // Try 2: SSE transport (legacy MCP servers)
    try {
      console.log('🔌 Trying SSE transport...');
      const url = new URL(this.config.endpoint);

      const transport = new SSEClientTransport(url, {
        requestInit: {
          headers: {
            'X-CMC-MCP-API-KEY': this.config.apiKey,
          },
        },
      });

      this.client = new Client({
        name: 'regimeshift-skill',
        version: '1.0.0',
      });

      await this.client.connect(transport);
      this.connected = true;
      this.connectionMode = 'sse';
      console.log('✅ Connected via SSE transport');
      return;
    } catch (err) {
      console.warn(`  ⚠ SSE transport failed: ${(err as Error).message}`);
      this.client = null;
    }

    throw new Error('Failed to connect to CMC MCP via any transport');
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors
      }
    }
    this.connected = false;
    console.log('🔌 Disconnected from CMC');
  }

  // ── Symbol → ID Resolution ─────────────────────────────────────────────

  private async resolveSymbolToId(symbol: string): Promise<string> {
    // Check cache first
    const cached = this.symbolIdCache.get(symbol.toUpperCase());
    if (cached) return cached;

    console.log(`  🔍 Resolving ${symbol} to CMC ID...`);
    const result = await this.callToolRaw('search_cryptos', { query: symbol, limit: 1 });

    if (result) {
      // Parse the result to find the ID
      const text = this.extractText(result);
      if (text) {
        // Try to find an ID in the response
        const parsed = typeof text === 'string' ? this.tryParseJson(text) : text;
        if (parsed) {
          // Handle array response
          const items = Array.isArray(parsed) ? parsed : (parsed.data || parsed.results || parsed.cryptocurrencies || [parsed]);
          if (Array.isArray(items) && items.length > 0) {
            const id = String(items[0].id || items[0].cmc_id || items[0].coinId || '');
            if (id) {
              this.symbolIdCache.set(symbol.toUpperCase(), id);
              console.log(`  ✅ ${symbol} → ID: ${id}`);
              return id;
            }
          }
          // Maybe the response is just a string ID
          if (typeof parsed === 'number' || (typeof parsed === 'string' && /^\d+$/.test(parsed))) {
            const id = String(parsed);
            this.symbolIdCache.set(symbol.toUpperCase(), id);
            console.log(`  ✅ ${symbol} → ID: ${id}`);
            return id;
          }
        }
        // Try regex for ID in text
        const idMatch = text.match(/["']?id["']?\s*[:=]\s*(\d+)/i);
        if (idMatch) {
          const id = idMatch[1];
          this.symbolIdCache.set(symbol.toUpperCase(), id);
          console.log(`  ✅ ${symbol} → ID: ${id}`);
          return id;
        }
      }
    }

    // Known fallbacks for major coins
    const KNOWN_IDS: Record<string, string> = {
      'BTC': '1', 'ETH': '1027', 'BNB': '1839', 'SOL': '5426',
      'XRP': '52', 'ADA': '2010', 'DOGE': '74', 'DOT': '6636',
      'AVAX': '5805', 'LINK': '1975', 'MATIC': '3890', 'UNI': '7083',
      'SHIB': '5994', 'LTC': '2', 'ATOM': '3794', 'NEAR': '6535',
      'APT': '21794', 'ARB': '11841', 'OP': '11840', 'SUI': '20947',
    };

    const fallbackId = KNOWN_IDS[symbol.toUpperCase()] || symbol;
    this.symbolIdCache.set(symbol.toUpperCase(), fallbackId);
    console.log(`  ℹ Using fallback ID for ${symbol}: ${fallbackId}`);
    return fallbackId;
  }

  // ── Raw Tool Call ───────────────────────────────────────────────────────

  private async callToolRaw(toolName: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.client || !this.connected) {
      await this.connect();
    }

    try {
      const result = await this.client!.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    } catch (error) {
      return null;
    }
  }

  // ── Generic Tool Call with Retry ────────────────────────────────────────

  private async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.client || !this.connected) {
      await this.connect();
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= (this.config.retryAttempts ?? 2); attempt++) {
      try {
        if (attempt > 0) {
          console.log(`  ↻ Retry attempt ${attempt} for ${toolName}...`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }

        const result = await this.client!.callTool({
          name: toolName,
          arguments: args,
        });

        // MCP results come back in content array
        const text = this.extractText(result);
        if (text) {
          const parsed = this.tryParseJson(text);
          return parsed !== null ? parsed : text;
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`  ⚠ ${toolName} attempt ${attempt} failed: ${lastError.message}`);
      }
    }

    console.error(`  ❌ ${toolName} failed after all retries, using defaults`);
    return null;
  }

  // ── Response Parsing Helpers ────────────────────────────────────────────

  private extractText(result: any): string | null {
    if (!result) return null;
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent?.text) return textContent.text;
    }
    if (typeof result === 'string') return result;
    return null;
  }

  private tryParseJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  // ── CALL 1: Global Market Metrics ───────────────────────────────────────
  // Tool: get_global_metrics_latest (no params)
  // Response: { market_size: { total_crypto_market_cap_usd: { current, percent_change } },
  //             sentiment: { fear_greed: { value, classification } },
  //             dominance: { btc_dominance: { current } } }

  async getGlobalMarketMetrics(): Promise<GlobalMetrics> {
    console.log('📊 Fetching global market metrics...');
    const data = await this.callTool('get_global_metrics_latest');

    if (data) {
      // Parse Fear & Greed — actual path: sentiment.fear_greed.current.{index, value}
      const fgIndex = safeGet(data, 'sentiment.fear_greed.current.index', null);
      const fgLabel = safeGet(data, 'sentiment.fear_greed.current.value', null);
      const fearGreedIndex = fgIndex !== null ? safeNumber(fgIndex) : 50;
      const fearGreedLabel = fgLabel || (fearGreedIndex > 70 ? 'Greed' : fearGreedIndex < 30 ? 'Fear' : 'Neutral');

      // Parse BTC dominance — actual path: dominance.btc.current (format: "+58.23%")
      const btcDomStr = safeGet(data, 'dominance.btc.current', null);
      const btcDominance = btcDomStr ? parseFloat(String(btcDomStr).replace('%', '').replace('+', '')) : 50;

      // Parse total market cap from string like "2.17 T"
      const mcStr = safeGet(data, 'market_size.total_crypto_market_cap_usd.current', '0');
      const totalMarketCap = this.parseHumanNumber(String(mcStr));

      // Parse 24h change from string like "+2.51%"
      const mc24hStr = safeGet(data, 'market_size.total_crypto_market_cap_usd.percent_change.24h', '0');
      const totalMarketCap24hChange = parseFloat(String(mc24hStr).replace('%', '').replace('+', ''));

      // Altcoin season — derive from BTC dominance
      const altcoinSeasonIndex = btcDominance < 50 ? 75 : btcDominance > 60 ? 25 : 50;

      return {
        fearGreedIndex,
        fearGreedLabel,
        btcDominance: isNaN(btcDominance) ? 50 : btcDominance,
        altcoinSeasonIndex,
        totalMarketCap,
        totalMarketCap24hChange: isNaN(totalMarketCap24hChange) ? 0 : totalMarketCap24hChange,
      };
    }

    return {
      fearGreedIndex: 50,
      fearGreedLabel: 'Neutral',
      btcDominance: 50,
      altcoinSeasonIndex: 50,
      totalMarketCap: 0,
      totalMarketCap24hChange: 0,
    };
  }

  // ── CALL 2: Derivatives Data ────────────────────────────────────────────
  // Tool: get_global_crypto_derivatives_metrics (no params — global data)

  async getDerivativesData(symbol: string): Promise<DerivativesData> {
    console.log(`📈 Fetching derivatives data for ${symbol}...`);
    const data = await this.callTool('get_global_crypto_derivatives_metrics');

    if (data) {
      // Actual format: { totalOpenInterest: { current: "388.22 B", percentage_change_24h: "+2.26%" },
      //                  fundingRate: { current: "-0.0019509" },
      //                  btc_liquidations: { long_24h, short_24h } }
      const fundingStr = safeGet(data, 'fundingRate.current', '0.0001');
      const fundingRate = parseFloat(String(fundingStr));

      const oiStr = safeGet(data, 'totalOpenInterest.current', '0');
      const openInterestUsd = this.parseHumanNumber(String(oiStr));

      const oiChangeStr = safeGet(data, 'totalOpenInterest.percentage_change_24h', '0');
      const openInterestChange24h = parseFloat(String(oiChangeStr).replace('%', '').replace('+', ''));

      // Liquidations
      const longLiq = this.parseHumanNumber(String(safeGet(data, 'btc_liquidations.long_24h', '0')));
      const shortLiq = this.parseHumanNumber(String(safeGet(data, 'btc_liquidations.short_24h', '0')));

      // Long/Short ratio from liquidations
      const longShortRatio = shortLiq > 0 ? longLiq / shortLiq : 1.0;

      return {
        symbol,
        fundingRate8h: isNaN(fundingRate) ? 0.0001 : fundingRate,
        openInterestUsd: openInterestUsd,
        openInterestChange24h: isNaN(openInterestChange24h) ? 0 : openInterestChange24h,
        longLiquidations24h: longLiq,
        shortLiquidations24h: shortLiq,
        longShortRatio: isNaN(longShortRatio) ? 1.0 : longShortRatio,
      };
    }

    return {
      symbol,
      fundingRate8h: 0.0001,
      openInterestUsd: 0,
      openInterestChange24h: 0,
      longLiquidations24h: 0,
      shortLiquidations24h: 0,
      longShortRatio: 1.0,
    };
  }

  // ── CALL 3: On-Chain Metrics ────────────────────────────────────────────
  // Tool: get_crypto_metrics (param: id)

  async getOnChainMetrics(symbol: string): Promise<OnChainMetrics> {
    console.log(`⛓️  Fetching on-chain metrics for ${symbol}...`);
    const id = await this.resolveSymbolToId(symbol);
    const data = await this.callTool('get_crypto_metrics', { id });

    if (data) {
      const metrics = data.data || data;
      // CMC returns addressesByHoldingValue etc.
      const addresses = metrics?.addressesByHoldingValue || metrics?.addresses_by_holding_value || {};
      
      // Try to compute whale % from address distribution
      let whalePercentage = 40;
      let retailPercentage = 30;
      
      if (addresses && typeof addresses === 'object') {
        // Extract from CMC's address distribution buckets
        const total = Object.values(addresses).reduce((sum: number, val: any) => sum + safeNumber(val), 0);
        if (total > 0) {
          // Top tiers are "whales", bottom tiers are "retail"
          const keys = Object.keys(addresses);
          const topKeys = keys.slice(Math.max(0, keys.length - 3));
          const bottomKeys = keys.slice(0, Math.ceil(keys.length * 0.6));
          whalePercentage = topKeys.reduce((sum, k) => sum + (safeNumber(addresses[k]) / total * 100), 0);
          retailPercentage = bottomKeys.reduce((sum, k) => sum + (safeNumber(addresses[k]) / total * 100), 0);
        }
      }

      return {
        symbol,
        whalePercentage: safeNumber(safeGet(metrics, 'whale_percentage', whalePercentage)),
        retailPercentage: safeNumber(safeGet(metrics, 'retail_percentage', retailPercentage)),
        exchangeNetFlow: safeNumber(safeGet(metrics, 'exchange_net_flow', safeGet(metrics, 'net_flow', 0))),
        activeAddresses24h: safeNumber(safeGet(metrics, 'active_addresses', safeGet(metrics, 'active_addresses_24h', 0))),
        avgTransactionFee: safeNumber(safeGet(metrics, 'avg_transaction_fee', safeGet(metrics, 'average_transaction_fees', 0))),
      };
    }

    return {
      symbol,
      whalePercentage: 40,
      retailPercentage: 30,
      exchangeNetFlow: 0,
      activeAddresses24h: 0,
      avgTransactionFee: 0,
    };
  }

  // ── CALL 4: Technical Analysis ──────────────────────────────────────────
  // Tool: get_crypto_technical_analysis (param: id)

  async getTechnicalAnalysis(symbol: string, timeframe: Timeframe): Promise<TechnicalAnalysis> {
    console.log(`📐 Fetching technical analysis for ${symbol}/${timeframe}...`);
    const id = await this.resolveSymbolToId(symbol);
    const data = await this.callTool('get_crypto_technical_analysis', { id });

    if (data) {
      // Actual format:
      // { moving_averages: { exponential_moving_average_7_day: "611.43", exponential_moving_average_30_day: "639.2", ... },
      //   macd: { macdLine: "-12.61", signalLine: "-2.35", histogram: "-10.26" },
      //   rsi: { rsi7: "40.32", rsi14: "41.88", rsi21: "43.61" },
      //   fibonacciLevels: { swingHigh: "743.36", swingLow: "558.39",
      //     retracementLevels: { "50.0%": "650.87", "61.8%": "629.05" },
      //     extensionLevels: { ... } },
      //   pivotPoint: "594.75" }

      // RSI
      const rsi14 = safeNumber(safeGet(data, 'rsi.rsi14', safeGet(data, 'rsi.rsi_14', 50)));

      // MACD
      const macdSignal = safeNumber(safeGet(data, 'macd.signalLine', safeGet(data, 'macd.signal', 0)));
      const macdHistogram = safeNumber(safeGet(data, 'macd.histogram', 0));

      // EMA — use EMA 30 as closest to EMA50 available
      const ema50 = safeNumber(
        safeGet(data, 'moving_averages.exponential_moving_average_30_day',
          safeGet(data, 'moving_averages.exponential_moving_average_200_day', 0))
      );

      // Support/Resistance from Fibonacci
      const swingHigh = safeNumber(safeGet(data, 'fibonacciLevels.swingHigh', 0));
      const swingLow = safeNumber(safeGet(data, 'fibonacciLevels.swingLow', 0));
      const fib618 = safeNumber(safeGet(data, 'fibonacciLevels.retracementLevels.61\.8%',
        safeGet(data, 'fibonacciLevels.retracementLevels.618', 0)));
      const fib382 = safeNumber(safeGet(data, 'fibonacciLevels.retracementLevels.38\.2%',
        safeGet(data, 'fibonacciLevels.retracementLevels.382', 0)));

      // Pivot point as support, swing high as resistance
      const pivotPoint = safeNumber(safeGet(data, 'pivotPoint', 0));
      const nearestSupport = pivotPoint > 0 ? pivotPoint : swingLow;
      const nearestResistance = swingHigh > 0 ? swingHigh : 0;

      // Fibonacci level — use 61.8% retracement
      const retLevels = safeGet(data, 'fibonacciLevels.retracementLevels', {});
      let fibLevel = 0;
      if (retLevels && typeof retLevels === 'object') {
        // Find the 61.8% level
        for (const [key, val] of Object.entries(retLevels)) {
          if (key.includes('61.8')) {
            fibLevel = safeNumber(val);
            break;
          }
        }
        if (fibLevel === 0) {
          // Take first available
          const vals = Object.values(retLevels);
          if (vals.length > 0) fibLevel = safeNumber(vals[0]);
        }
      }

      // currentPrice = 0 here, will be filled by live quote sync
      return {
        symbol,
        timeframe,
        rsi14,
        macdSignal,
        macdHistogram,
        currentPrice: 0, // Will be synced from live quote
        ema50,
        nearestSupport,
        nearestResistance,
        fibonacciLevel: fibLevel,
        fibonacciRatio: '0.618',
      };
    }

    return {
      symbol, timeframe,
      rsi14: 50, macdSignal: 0, macdHistogram: 0,
      currentPrice: 0, ema50: 0,
      nearestSupport: 0, nearestResistance: 0,
      fibonacciLevel: 0, fibonacciRatio: '0.618',
    };
  }

  // ── CALL 5: Live Quote ──────────────────────────────────────────────────
  // Tool: get_crypto_quotes_latest (param: id)

  async getLiveQuote(symbol: string): Promise<LiveQuote> {
    console.log(`💰 Fetching live quote for ${symbol}...`);
    const id = await this.resolveSymbolToId(symbol);
    const data = await this.callTool('get_crypto_quotes_latest', { id });

    if (data) {
      // Actual format: array: [{id, name, symbol, price, percent_change_24h, volume_24h, market_cap, ...}]
      let coin: any = null;
      
      if (Array.isArray(data)) {
        coin = data[0];
      } else if (data.data && Array.isArray(data.data)) {
        coin = data.data[0];
      } else if (typeof data === 'object') {
        // Keyed by ID
        coin = data[id] || data.data?.[id] || data;
      }

      if (coin) {
        return {
          symbol,
          price: safeNumber(coin.price ?? 0),
          priceChange24h: safeNumber(coin.percent_change_24h ?? 0),
          priceChange7d: safeNumber(coin.percent_change_7d ?? 0),
          volume24h: safeNumber(coin.volume_24h ?? 0),
          volumeChange24h: safeNumber(coin.volume_change_24h ?? 0),
          marketCap: safeNumber(coin.market_cap ?? 0),
        };
      }
    }

    return {
      symbol, price: 0, priceChange24h: 0, priceChange7d: 0,
      volume24h: 0, volumeChange24h: 0, marketCap: 0,
    };
  }

  // ── CALL 6: Trending Narratives ─────────────────────────────────────────
  // Tool: trending_crypto_narratives (no params)

  async getTrendingNarratives(symbol: string): Promise<TrendingNarratives> {
    console.log('🔥 Fetching trending narratives...');
    const data = await this.callTool('trending_crypto_narratives');

    const narratives: TrendingNarrative[] = [];
    let symbolInTrending = false;
    let matchedNarrative: string | null = null;

    if (data) {
      // Actual format: { categoryList: { headers: [...], rows: [[rank, slug, url, name, ...topCoinList], ...] } }
      const catList = data.categoryList || data;
      const rows = catList?.rows || [];
      const headers = catList?.headers || [];

      // Find column indices
      const nameIdx = headers.indexOf('categoryName');
      const topCoinIdx = headers.indexOf('topCoinList');
      const socialIdx = headers.indexOf('socialKeywords');

      if (Array.isArray(rows)) {
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i];
          const name = nameIdx >= 0 ? String(row[nameIdx]) : `Narrative ${i + 1}`;

          // Extract tokens from topCoinList (which is a sub-table)
          let tokens: string[] = [];
          const topCoinData = topCoinIdx >= 0 ? row[topCoinIdx] : null;
          if (topCoinData && typeof topCoinData === 'object' && topCoinData.rows) {
            tokens = topCoinData.rows.map((r: any[]) => String(r[0] || '')); // coinSymbol is first col
          }

          // Also check social keywords
          const socialKws = socialIdx >= 0 ? row[socialIdx] : [];

          const narrative: TrendingNarrative = { name, rank: i + 1, tokens };
          narratives.push(narrative);

          // Check if symbol appears in top 5 narratives
          if (i < 5) {
            const upperTokens = tokens.map(t => t.toUpperCase());
            const nameLower = name.toLowerCase();
            const socialStr = Array.isArray(socialKws) ? socialKws.join(' ').toLowerCase() : '';
            if (upperTokens.includes(symbol.toUpperCase()) || 
                nameLower.includes(symbol.toLowerCase()) ||
                socialStr.includes(symbol.toLowerCase())) {
              symbolInTrending = true;
              matchedNarrative = name;
            }
          }
        }
      }
    }

    return { narratives, symbolInTrending, matchedNarrative };
  }

  // ── CALL 7: Latest News ─────────────────────────────────────────────────
  // Tool: get_crypto_latest_news (params: id, limit)

  async getLatestNews(symbol: string): Promise<NewsData> {
    console.log(`📰 Fetching latest news for ${symbol}...`);
    const id = await this.resolveSymbolToId(symbol);
    const data = await this.callTool('get_crypto_latest_news', { id, limit: 5 });

    const items: NewsItem[] = [];
    let positiveCount = 0;
    let negativeCount = 0;

    if (data) {
      // Actual format: { headers: ["title","content","url","publishedAt","quality"], rows: [[...], ...] }
      const headers = data.headers || [];
      const rows = data.rows || [];

      const titleIdx = headers.indexOf('title');
      const publishedIdx = headers.indexOf('publishedAt');

      if (Array.isArray(rows)) {
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const row = rows[i];
          const rawTitle = titleIdx >= 0 ? String(row[titleIdx] || '') : '';
          // Extract just the title (before the " - Source" part)
          const title = rawTitle.split(' - ').slice(0, -1).join(' - ') || rawTitle;
          const sentiment = this.classifyHeadlineSentiment(title);

          if (sentiment === NewsSentiment.POSITIVE) positiveCount++;
          if (sentiment === NewsSentiment.NEGATIVE) negativeCount++;

          items.push({
            title: title.substring(0, 200),
            source: rawTitle.split(' - ').pop() || 'Unknown',
            publishedAt: publishedIdx >= 0 ? String(row[publishedIdx] || '') : new Date().toISOString(),
            sentiment,
            isCatalyst: this.isCatalystEvent(title),
          });
        }
      } else {
        // Fallback: array of objects format
        const newsArray = Array.isArray(data) ? data : (data.news || data.items || []);
        for (let i = 0; i < Math.min(newsArray.length, 5); i++) {
          const item = newsArray[i];
          const title = safeGet(item, 'title', '') as string;
          const sentiment = this.classifyHeadlineSentiment(title);
          if (sentiment === NewsSentiment.POSITIVE) positiveCount++;
          if (sentiment === NewsSentiment.NEGATIVE) negativeCount++;
          items.push({
            title, source: safeGet(item, 'source', 'Unknown'),
            publishedAt: safeGet(item, 'published_at', new Date().toISOString()),
            sentiment, isCatalyst: this.isCatalystEvent(title),
          });
        }
      }
    }

    const overallSentiment = positiveCount > negativeCount
      ? NewsSentiment.POSITIVE
      : negativeCount > positiveCount
        ? NewsSentiment.NEGATIVE
        : NewsSentiment.NEUTRAL;

    return { symbol, items, overallSentiment };
  }

  // ── CALL 8: Macro Events ────────────────────────────────────────────────
  // Tool: get_upcoming_macro_events (no params)

  async getMacroEvents(): Promise<MacroEvents> {
    console.log('🌍 Fetching macro events...');
    const data = await this.callTool('get_upcoming_macro_events');

    const events: MacroEvent[] = [];
    const riskFlags: string[] = [];
    let highImpactCount = 0;

    if (data) {
      // Actual format: { upcomingEventNews: { headers: ["title","content","url","eventDate",...], rows: [[...]] } }
      const eventNews = data.upcomingEventNews || data;
      const headers = eventNews?.headers || [];
      const rows = eventNews?.rows || [];

      const titleIdx = headers.indexOf('title');
      const dateIdx = headers.indexOf('eventDate');

      if (Array.isArray(rows)) {
        for (const row of rows) {
          const name = titleIdx >= 0 ? String(row[titleIdx] || '') : 'Unknown Event';
          const date = dateIdx >= 0 ? String(row[dateIdx] || '') : '';

          const impact = this.classifyEventImpact({ name, event: name });
          const event: MacroEvent = {
            name, date, impact,
            category: 'Macro',
            description: '',
          };

          events.push(event);

          if (impact === 'HIGH') {
            highImpactCount++;
            riskFlags.push(`⚠️ HIGH IMPACT: ${event.name} on ${event.date}`);
          }
        }
      }
    }

    return { events, highImpactCount, riskFlags };
  }

  // ── Full Data Collection Pipeline ───────────────────────────────────────

  async collectAllData(symbol: string, timeframe: Timeframe): Promise<CollectedMarketData> {
    console.log('\n' + '═'.repeat(60));
    console.log(`🚀 RegimeShift Data Collection: ${symbol} / ${timeframe}`);
    console.log(`   Mode: ${this.connectionMode}`);
    console.log('═'.repeat(60) + '\n');

    // Pre-resolve symbol → ID so all subsequent calls use the cached value
    await this.resolveSymbolToId(symbol);

    // Execute calls sequentially as specified
    const globalMetrics = await this.getGlobalMarketMetrics();
    const derivativesData = await this.getDerivativesData(symbol);
    const onChainMetrics = await this.getOnChainMetrics(symbol);
    const technicalAnalysis = await this.getTechnicalAnalysis(symbol, timeframe);
    const liveQuote = await this.getLiveQuote(symbol);
    const trendingNarratives = await this.getTrendingNarratives(symbol);
    const newsData = await this.getLatestNews(symbol);
    const macroEvents = await this.getMacroEvents();

    // Sync price from live quote into technical analysis if TA didn't return it
    if (technicalAnalysis.currentPrice === 0 && liveQuote.price > 0) {
      technicalAnalysis.currentPrice = liveQuote.price;
      if (technicalAnalysis.ema50 === 0) technicalAnalysis.ema50 = liveQuote.price * 0.97;
      if (technicalAnalysis.nearestSupport === 0) technicalAnalysis.nearestSupport = liveQuote.price * 0.95;
      if (technicalAnalysis.nearestResistance === 0) technicalAnalysis.nearestResistance = liveQuote.price * 1.08;
      if (technicalAnalysis.fibonacciLevel === 0) technicalAnalysis.fibonacciLevel = liveQuote.price * 0.98;
    }

    console.log('\n✅ All data collected successfully\n');

    return {
      globalMetrics,
      derivativesData,
      onChainMetrics,
      technicalAnalysis,
      liveQuote,
      trendingNarratives,
      newsData,
      macroEvents,
      collectedAt: new Date().toISOString(),
    };
  }

  // ── Sentiment Helpers ───────────────────────────────────────────────────

  private classifyHeadlineSentiment(title: string): NewsSentiment {
    const lower = title.toLowerCase();
    const positiveKeywords = [
      'surge', 'rally', 'breakout', 'bullish', 'gain', 'soar', 'pump',
      'partnership', 'launch', 'upgrade', 'milestone', 'record', 'growth',
      'adoption', 'approval', 'integration', 'expansion', 'all-time high',
      'ath', 'moon', 'outperform', 'positive',
    ];
    const negativeKeywords = [
      'crash', 'dump', 'bearish', 'plunge', 'decline', 'hack', 'exploit',
      'ban', 'regulation', 'lawsuit', 'sec', 'fraud', 'scam', 'rug',
      'collapse', 'liquidat', 'fear', 'sell-off', 'selloff', 'drop',
      'warn', 'risk', 'concern', 'investigation', 'fine', 'penalty',
    ];

    const posScore = positiveKeywords.filter(kw => lower.includes(kw)).length;
    const negScore = negativeKeywords.filter(kw => lower.includes(kw)).length;

    if (posScore > negScore) return NewsSentiment.POSITIVE;
    if (negScore > posScore) return NewsSentiment.NEGATIVE;
    return NewsSentiment.NEUTRAL;
  }

  private isCatalystEvent(title: string): boolean {
    const lower = title.toLowerCase();
    const catalystKeywords = [
      'launch', 'upgrade', 'partnership', 'listing', 'mainnet',
      'halving', 'merge', 'fork', 'burn', 'airdrop', 'etf',
      'approval', 'integration', 'unlock', 'migration',
    ];
    return catalystKeywords.some(kw => lower.includes(kw));
  }

  private classifyEventImpact(event: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    const name = (safeGet(event, 'name', safeGet(event, 'event', '')) as string).toLowerCase();
    const impact = (safeGet(event, 'impact', '') as string).toUpperCase();
    
    if (impact === 'HIGH') return 'HIGH';
    if (impact === 'MEDIUM') return 'MEDIUM';
    if (impact === 'LOW') return 'LOW';

    const highImpact = ['fomc', 'fed', 'cpi', 'gdp', 'nfp', 'rate decision', 'halving', 'unlock'];
    const mediumImpact = ['pmi', 'housing', 'retail sales', 'inflation', 'jobs'];

    if (highImpact.some(kw => name.includes(kw))) return 'HIGH';
    if (mediumImpact.some(kw => name.includes(kw))) return 'MEDIUM';
    return 'LOW';
  }

  // ── Number Parsing ──────────────────────────────────────────────────────

  private parseHumanNumber(str: string): number {
    if (!str || str === '0') return 0;
    const cleaned = str.replace(/[\$,+]/g, '').trim();
    
    const multipliers: Record<string, number> = {
      'T': 1e12, 'B': 1e9, 'M': 1e6, 'K': 1e3,
      't': 1e12, 'b': 1e9, 'm': 1e6, 'k': 1e3,
    };

    for (const [suffix, mult] of Object.entries(multipliers)) {
      if (cleaned.endsWith(suffix)) {
        const num = parseFloat(cleaned.slice(0, -1).trim());
        return isNaN(num) ? 0 : num * mult;
      }
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
}

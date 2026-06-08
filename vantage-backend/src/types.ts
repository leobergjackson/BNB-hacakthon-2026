// ============================================================================
// RegimeShift CMC Skill — Type Definitions
// All data models, enums, and interfaces for the regime detection pipeline
// ============================================================================

// ─── Input Schema ───────────────────────────────────────────────────────────

export type Timeframe = '1d' | '4h' | '1w';
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

export interface SkillInput {
  symbol: string;
  timeframe: Timeframe;
  risk_profile: RiskProfile;
  portfolio_size_usd?: number;
}

// ─── Signal Enums ───────────────────────────────────────────────────────────

export enum LeverageSentiment {
  GREED = 'GREED',
  NEUTRAL = 'NEUTRAL',
  FEAR = 'FEAR',
}

export enum SmartMoneySignal {
  ACCUMULATION = 'ACCUMULATION',
  NEUTRAL = 'NEUTRAL',
  DISTRIBUTION = 'DISTRIBUTION',
}

export enum TechnicalBias {
  BULLISH = 'BULLISH',
  NEUTRAL = 'NEUTRAL',
  BEARISH = 'BEARISH',
}

export enum NarrativeHeat {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
}

export enum NewsSentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

export enum FearGreedSignal {
  GREED = 'GREED',
  NEUTRAL = 'NEUTRAL',
  FEAR = 'FEAR',
}

// ─── Regime Enums ───────────────────────────────────────────────────────────

export enum RegimeClassification {
  BULL_REGIME = 'BULL_REGIME',
  CAUTIOUS_BULL = 'CAUTIOUS_BULL',
  CHOPPY = 'CHOPPY',
  CAUTIOUS_BEAR = 'CAUTIOUS_BEAR',
  BEAR_REGIME = 'BEAR_REGIME',
}

export enum DivergenceType {
  TOPPING_SIGNAL = 'TOPPING_SIGNAL',
  BOTTOMING_SIGNAL = 'BOTTOMING_SIGNAL',
  EARLY_MOVE_SIGNAL = 'EARLY_MOVE_SIGNAL',
}

// ─── CMC Data Models ────────────────────────────────────────────────────────

export interface GlobalMetrics {
  fearGreedIndex: number;          // 0-100
  fearGreedLabel: string;          // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  btcDominance: number;            // percentage
  altcoinSeasonIndex: number;      // 0-100
  totalMarketCap: number;          // USD
  totalMarketCap24hChange: number; // percentage
}

export interface DerivativesData {
  symbol: string;
  fundingRate8h: number;           // e.g. 0.0001 = 0.01%
  openInterestUsd: number;
  openInterestChange24h: number;   // percentage
  longLiquidations24h: number;     // USD
  shortLiquidations24h: number;    // USD
  longShortRatio: number;          // > 1 means more longs
}

export interface OnChainMetrics {
  symbol: string;
  whalePercentage: number;         // % held by top 1% addresses
  retailPercentage: number;        // % held by bottom 60% addresses
  exchangeNetFlow: number;         // positive = inflow (selling pressure)
  activeAddresses24h: number;
  avgTransactionFee: number;       // USD
}

export interface TechnicalAnalysis {
  symbol: string;
  timeframe: string;
  rsi14: number;
  macdSignal: number;
  macdHistogram: number;
  currentPrice: number;
  ema50: number;
  nearestSupport: number;
  nearestResistance: number;
  fibonacciLevel: number;          // nearest fib retracement to price
  fibonacciRatio: string;          // e.g. "0.618"
}

export interface LiveQuote {
  symbol: string;
  price: number;
  priceChange24h: number;          // percentage
  priceChange7d: number;           // percentage
  volume24h: number;
  volumeChange24h: number;         // percentage
  marketCap: number;
}

export interface TrendingNarrative {
  name: string;
  rank: number;
  tokens: string[];
}

export interface TrendingNarratives {
  narratives: TrendingNarrative[];
  symbolInTrending: boolean;
  matchedNarrative: string | null;
}

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  sentiment: NewsSentiment;
  isCatalyst: boolean;
}

export interface NewsData {
  symbol: string;
  items: NewsItem[];
  overallSentiment: NewsSentiment;
}

export interface MacroEvent {
  name: string;
  date: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
}

export interface MacroEvents {
  events: MacroEvent[];
  highImpactCount: number;
  riskFlags: string[];
}

// ─── Collected Market Data ──────────────────────────────────────────────────

export interface CollectedMarketData {
  globalMetrics: GlobalMetrics;
  derivativesData: DerivativesData;
  onChainMetrics: OnChainMetrics;
  technicalAnalysis: TechnicalAnalysis;
  liveQuote: LiveQuote;
  trendingNarratives: TrendingNarratives;
  newsData: NewsData;
  macroEvents: MacroEvents;
  collectedAt: string;
}

// ─── Signal Breakdown ───────────────────────────────────────────────────────

export interface SignalEntry {
  signal: string;
  rawValue: string;
  label: string;
  score: number;       // -1, 0, or +1
  weight: number;      // weight in composite
  weightedScore: number;
}

export interface SignalBreakdown {
  signals: SignalEntry[];
  compositeScore: number;
}

// ─── Regime Result ──────────────────────────────────────────────────────────

export interface Divergence {
  type: DivergenceType;
  description: string;
  convictionImpact: number;    // +2 or -2
}

export interface RegimeResult {
  classification: RegimeClassification;
  compositeScore: number;
  conviction: number;           // 1-10
  signalBreakdown: SignalBreakdown;
  divergences: Divergence[];
  leverageSentiment: LeverageSentiment;
  smartMoneySignal: SmartMoneySignal;
  technicalBias: TechnicalBias;
  narrativeHeat: NarrativeHeat;
  fearGreedSignal: FearGreedSignal;
  newsSentiment: NewsSentiment;
}

// ─── Strategy Spec ──────────────────────────────────────────────────────────

export interface EntryRules {
  primaryTrigger: string;
  confirmation: string;
  entryPriceZone: {
    low: number;
    high: number;
  };
}

export interface ExitRules {
  takeProfit1: {
    percentage: number;
    positionSize: string;     // e.g. "50% of position"
    price: number;
  };
  takeProfit2: {
    price: number;
    description: string;
  };
  stopLoss: {
    price: number;
    percentage: number;
  };
  trailingStop: {
    activateAt: string;       // e.g. "TP1 hit"
    trailPercentage: number;
  };
  timeStop: {
    candles: number;
    description: string;
  };
}

export interface PositionSizing {
  baseAllocation: number;      // percentage
  convictionMultiplier: number;
  finalAllocation: number;     // percentage
  maxRiskPerTrade: number;     // percentage (always 2%)
  positionSizeUsd?: number;    // if portfolio_size_usd was provided
}

export interface BacktestParameters {
  lookbackWindow: number;      // days
  dataFrequency: string;
  benchmark: string;
  entrySlippage: number;       // percentage
  exitSlippage: number;        // percentage
  transactionCost: number;     // percentage per trade
  minSampleSize: number;
}

export interface StrategySpec {
  strategyName: string;
  generatedAt: string;
  asset: string;
  timeframe: Timeframe;
  regime: RegimeClassification;
  compositeScore: number;
  conviction: number;

  entryRules: EntryRules;
  exitRules: ExitRules;
  positionSizing: PositionSizing;
  invalidation: string[];
  backtestParameters: BacktestParameters;
  riskFlags: string[];
  signalBreakdown: SignalBreakdown;
  divergencesDetected: Divergence[];
  
  // Raw data references
  marketDataSnapshot: {
    price: number;
    btcDominance: number;
    fearGreedIndex: number;
    totalMarketCap24hChange: number;
  };
}

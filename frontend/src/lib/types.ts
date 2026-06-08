export const ASSETS = ["BNB", "BTC", "ETH", "SOL"] as const;
export const TIMEFRAMES = ["1h", "4h", "1d"] as const;
export const RISK_PROFILES = ["conservative", "balanced", "aggressive"] as const;

export type AssetSymbol = (typeof ASSETS)[number];
export type Timeframe = (typeof TIMEFRAMES)[number];
export type RiskProfile = (typeof RISK_PROFILES)[number];
export type DataSource = "coinmarketcap" | "demo";

export interface StrategyRequest {
  asset: AssetSymbol;
  timeframe: Timeframe;
  riskProfile: RiskProfile;
  maxDrawdownPct: number;
  startingEquity: number;
  feeBps: number;
  slippageBps: number;
  lookbackBars: number;
}

export interface MarketCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataset {
  source: DataSource;
  sourceLabel: string;
  endpoint?: string;
  fallbackReason?: string;
  candles: MarketCandle[];
}

export interface StrategyParameters {
  emaFast: number;
  emaSlow: number;
  atrPeriod: number;
  rsiPeriod: number;
  volumePeriod: number;
  riskPerTradePct: number;
  stopAtrMultiple: number;
  takeProfitR: number;
  maxPositionPct: number;
  rsiMin: number;
  rsiMax: number;
  feeBps: number;
  slippageBps: number;
  maxDrawdownPct: number;
}

export interface StrategySpec {
  id: string;
  title: string;
  track: string;
  generatedAt: string;
  asset: AssetSymbol;
  timeframe: Timeframe;
  objective: string;
  dataInputs: {
    provider: string;
    source: DataSource;
    endpoint?: string;
    fields: string[];
    candles: number;
  };
  assumptions: string[];
  indicators: string[];
  entryRules: string[];
  exitRules: string[];
  riskControls: string[];
  validation: string[];
  parameters: StrategyParameters;
}

export interface Trade {
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  returnPct: number;
  reason: string;
  barsHeld: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
}

export interface BacktestMetrics {
  totalReturnPct: number;
  winRatePct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  profitFactor: number;
  trades: number;
  avgBarsHeld: number;
  endingEquity: number;
}

export interface StrategyResponse {
  request: StrategyRequest;
  dataset: Omit<MarketDataset, "candles"> & {
    firstCandle: string;
    lastCandle: string;
    candleCount: number;
  };
  spec: StrategySpec;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: Trade[];
  summary: string[];
}

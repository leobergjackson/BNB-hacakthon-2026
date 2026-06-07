/**
 * Configuration constants for the NeuroSentiment Trader strategy engine.
 */
export const strategyConfig = {
  REBALANCE_INTERVAL_MS: 15 * 60 * 1000,  // 15 min
  SNAPSHOT_INTERVAL_MS: 60 * 60 * 1000,    // 1 hour
  MAX_DRAWDOWN_PERCENT: 28,                 // buffer before 30% DQ
  MAX_POSITION_PERCENT: 5,                  // per trade
  MAX_SINGLE_TOKEN_EXPOSURE: 20,            // percent
  MIN_DAILY_TRADES: 1,
  SLIPPAGE_TOLERANCE: 0.01,                 // 1%
  PORTFOLIO_FLOOR_USD: 2,                   // buffer above $1
  STABLECOIN_SYMBOLS: ['USDT', 'USDC', 'DAI', 'FDUSD', 'FRAX'],
  DEX_ROUTER: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // PancakeSwap V3 BSC Router
  COMPETITION_CONTRACT: '0x212c61b9b72c95d95bf29cf032f5e5635629aed5'
};

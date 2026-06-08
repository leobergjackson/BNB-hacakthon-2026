#!/usr/bin/env bash
# ============================================================================
# RegimeShift CMC Skill — Demo Script
# One-command demo that runs the Skill with sample inputs
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Banner
echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║${WHITE}     🔄 RegimeShift — Market Regime Detection Skill         ${PURPLE}║${NC}"
echo -e "${PURPLE}║${CYAN}     CoinMarketCap AI Agent Skill | BNB Hack Edition         ${PURPLE}║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Check for .env
if [ ! -f .env ]; then
  echo -e "${RED}❌ .env file not found. Please create one with CMC_API_KEY.${NC}"
  exit 1
fi

# Check for node_modules
if [ ! -d node_modules ]; then
  echo -e "${YELLOW}📦 Installing dependencies...${NC}"
  npm install
  echo ""
fi

# Parse arguments or use defaults
SYMBOL="${1:-BNB}"
TIMEFRAME="${2:-1d}"
RISK_PROFILE="${3:-moderate}"
PORTFOLIO_SIZE="${4:-100000}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${WHITE}  Demo Configuration:${NC}"
echo -e "${CYAN}  Symbol:          ${WHITE}${SYMBOL}${NC}"
echo -e "${CYAN}  Timeframe:       ${WHITE}${TIMEFRAME}${NC}"
echo -e "${CYAN}  Risk Profile:    ${WHITE}${RISK_PROFILE}${NC}"
echo -e "${CYAN}  Portfolio Size:  ${WHITE}\$${PORTFOLIO_SIZE}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}🚀 Running RegimeShift analysis...${NC}"
echo ""

# Run the skill
npx tsx src/index.ts \
  --symbol "$SYMBOL" \
  --timeframe "$TIMEFRAME" \
  --risk-profile "$RISK_PROFILE" \
  --portfolio-size "$PORTFOLIO_SIZE" \
  --format both

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${WHITE}  Demo complete! ${NC}"
echo -e "${CYAN}  Try other configurations:${NC}"
echo -e "${YELLOW}    ./demo/demo.sh BTC 4h conservative 50000${NC}"
echo -e "${YELLOW}    ./demo/demo.sh ETH 1w aggressive 200000${NC}"
echo -e "${YELLOW}    ./demo/demo.sh SOL 1d moderate${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

/**
 * Determines the broader market regime using sentiment and derivatives positioning.
 */
export class RegimeDetector {
  /**
   * Classify market as risk-on/risk-off/neutral using derivatives positioning + social heat.
   * @param {Object} globalState - Includes global fearGreedIndex.
   * @param {Array} tokens - Array of token states to aggregate funding rates and social heat.
   * @returns {string} 'risk-on' | 'risk-off' | 'neutral'
   */
  detectRegime(globalState, tokens) {
    const { fearGreedIndex } = globalState;
    
    // Average social heat across all tracked tokens
    const avgSocialHeat = tokens.reduce((sum, t) => sum + (t.sentimentScore || 0.5), 0) / (tokens.length || 1);
    
    // Average funding rate (positive = long bias, negative = short bias)
    const avgFundingRate = tokens.reduce((sum, t) => sum + (t.fundingRate || 0), 0) / (tokens.length || 1);

    // High fear/greed + high social heat + positive funding = risk-on
    if (fearGreedIndex > 65 && avgSocialHeat > 0.6 && avgFundingRate > 0) {
      return 'risk-on';
    }
    
    // Low fear/greed + low social heat + negative funding = risk-off
    if (fearGreedIndex < 35 && avgSocialHeat < 0.4 && avgFundingRate < 0) {
      return 'risk-off';
    }
    
    // Extreme fear can also trigger an immediate risk-off state regardless of funding
    if (fearGreedIndex < 20) {
      return 'risk-off';
    }

    return 'neutral';
  }
}

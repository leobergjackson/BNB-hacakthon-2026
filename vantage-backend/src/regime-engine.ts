// ============================================================================
// RegimeShift CMC Skill — Regime Detection Engine
// Weighted composite scoring matrix + divergence detection
// ============================================================================

import {
  CollectedMarketData,
  RegimeResult,
  RegimeClassification,
  LeverageSentiment,
  SmartMoneySignal,
  TechnicalBias,
  NarrativeHeat,
  FearGreedSignal,
  NewsSentiment,
  DivergenceType,
  Divergence,
  SignalBreakdown,
  SignalEntry,
} from './types.js';

// ─── Signal Weights ─────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS = {
  leverageSentiment: 0.25,
  smartMoney: 0.25,
  technicalBias: 0.20,
  narrativeHeat: 0.10,
  fearGreed: 0.10,
  newsSentiment: 0.10,
} as const;

// ─── Regime Engine ──────────────────────────────────────────────────────────

export class RegimeEngine {

  // ── Signal A: Leverage Sentiment ──────────────────────────────────────

  computeLeverageSentiment(data: CollectedMarketData): { signal: LeverageSentiment; score: number; rawValue: string } {
    const fundingRate = data.derivativesData.fundingRate8h;
    const fundingPct = fundingRate * 100; // convert to percentage

    let signal: LeverageSentiment;
    let score: number;

    if (fundingPct > 0.01) {
      signal = LeverageSentiment.GREED;
      score = 1;
    } else if (fundingPct < -0.005) {
      signal = LeverageSentiment.FEAR;
      score = -1;
    } else {
      signal = LeverageSentiment.NEUTRAL;
      score = 0;
    }

    return {
      signal,
      score,
      rawValue: `Funding Rate: ${(fundingRate * 100).toFixed(4)}% | OI: $${this.formatLargeNumber(data.derivativesData.openInterestUsd)} | L/S Ratio: ${data.derivativesData.longShortRatio.toFixed(2)}`,
    };
  }

  // ── Signal B: Smart Money Score ───────────────────────────────────────

  computeSmartMoneyScore(data: CollectedMarketData): { signal: SmartMoneySignal; score: number; rawValue: string } {
    const { whalePercentage, exchangeNetFlow } = data.onChainMetrics;

    let signal: SmartMoneySignal;
    let score: number;

    // Accumulation: whales holding more + net outflow from exchanges
    // Distribution: whales reducing + net inflow to exchanges
    const whaleStrength = whalePercentage > 45 ? 1 : whalePercentage < 35 ? -1 : 0;
    const flowSignal = exchangeNetFlow < 0 ? 1 : exchangeNetFlow > 0 ? -1 : 0;

    const combined = whaleStrength + flowSignal;

    if (combined >= 1) {
      signal = SmartMoneySignal.ACCUMULATION;
      score = 1;
    } else if (combined <= -1) {
      signal = SmartMoneySignal.DISTRIBUTION;
      score = -1;
    } else {
      signal = SmartMoneySignal.NEUTRAL;
      score = 0;
    }

    return {
      signal,
      score,
      rawValue: `Whale %: ${whalePercentage.toFixed(1)}% | Exchange Flow: ${exchangeNetFlow > 0 ? '+' : ''}${this.formatLargeNumber(exchangeNetFlow)} | Active Addrs: ${this.formatLargeNumber(data.onChainMetrics.activeAddresses24h)}`,
    };
  }

  // ── Signal C: Technical Bias ──────────────────────────────────────────

  computeTechnicalBias(data: CollectedMarketData): { signal: TechnicalBias; score: number; rawValue: string } {
    const ta = data.technicalAnalysis;
    let bullPoints = 0;
    let bearPoints = 0;

    // RSI signal
    if (ta.rsi14 > 55) bullPoints++;
    else if (ta.rsi14 < 45) bearPoints++;

    // MACD signal
    if (ta.macdHistogram > 0) bullPoints++;
    else if (ta.macdHistogram < 0) bearPoints++;

    // Price vs EMA50
    if (ta.currentPrice > ta.ema50) bullPoints++;
    else if (ta.currentPrice < ta.ema50) bearPoints++;

    let signal: TechnicalBias;
    let score: number;

    if (bullPoints >= 2) {
      signal = TechnicalBias.BULLISH;
      score = 1;
    } else if (bearPoints >= 2) {
      signal = TechnicalBias.BEARISH;
      score = -1;
    } else {
      signal = TechnicalBias.NEUTRAL;
      score = 0;
    }

    return {
      signal,
      score,
      rawValue: `RSI(14): ${ta.rsi14.toFixed(1)} | MACD Hist: ${ta.macdHistogram.toFixed(4)} | Price: $${ta.currentPrice.toFixed(2)} vs EMA50: $${ta.ema50.toFixed(2)} | Support: $${ta.nearestSupport.toFixed(2)} | Resistance: $${ta.nearestResistance.toFixed(2)}`,
    };
  }

  // ── Signal D: Narrative Heat ──────────────────────────────────────────

  computeNarrativeHeat(data: CollectedMarketData): { signal: NarrativeHeat; score: number; rawValue: string } {
    const { symbolInTrending, matchedNarrative, narratives } = data.trendingNarratives;

    let signal: NarrativeHeat;
    let score: number;

    if (symbolInTrending) {
      signal = NarrativeHeat.HOT;
      score = 1;
    } else if (narratives.length > 0) {
      // Check if the symbol's broader ecosystem is trending
      signal = NarrativeHeat.WARM;
      score = 0;
    } else {
      signal = NarrativeHeat.COLD;
      score = -1;
    }

    const topNarratives = narratives.slice(0, 3).map(n => n.name).join(', ');

    return {
      signal,
      score,
      rawValue: `In Top 5 Trending: ${symbolInTrending ? 'YES' : 'NO'}${matchedNarrative ? ` (${matchedNarrative})` : ''} | Top Narratives: ${topNarratives || 'N/A'}`,
    };
  }

  // ── Signal E: Fear & Greed ────────────────────────────────────────────

  computeFearGreedSignal(data: CollectedMarketData): { signal: FearGreedSignal; score: number; rawValue: string } {
    const fgi = data.globalMetrics.fearGreedIndex;

    let signal: FearGreedSignal;
    let score: number;

    if (fgi > 70) {
      signal = FearGreedSignal.GREED;
      score = 1;
    } else if (fgi < 30) {
      signal = FearGreedSignal.FEAR;
      score = -1;
    } else {
      signal = FearGreedSignal.NEUTRAL;
      score = 0;
    }

    return {
      signal,
      score,
      rawValue: `Fear & Greed: ${fgi} (${data.globalMetrics.fearGreedLabel}) | BTC Dom: ${data.globalMetrics.btcDominance.toFixed(1)}% | Altcoin Season: ${data.globalMetrics.altcoinSeasonIndex} | Market Cap 24h: ${data.globalMetrics.totalMarketCap24hChange > 0 ? '+' : ''}${data.globalMetrics.totalMarketCap24hChange.toFixed(2)}%`,
    };
  }

  // ── Signal F: News Sentiment ──────────────────────────────────────────

  computeNewsSentiment(data: CollectedMarketData): { signal: NewsSentiment; score: number; rawValue: string } {
    const sentiment = data.newsData.overallSentiment;
    let score: number;

    switch (sentiment) {
      case NewsSentiment.POSITIVE: score = 1; break;
      case NewsSentiment.NEGATIVE: score = -1; break;
      default: score = 0;
    }

    const headlines = data.newsData.items.slice(0, 3).map(n => n.title).join(' | ');
    const catalysts = data.newsData.items.filter(n => n.isCatalyst).length;

    return {
      signal: sentiment,
      score,
      rawValue: `Overall: ${sentiment} | Catalysts: ${catalysts} | Headlines: ${headlines || 'N/A'}`,
    };
  }

  // ── Composite Score & Regime Classification ───────────────────────────

  computeRegime(data: CollectedMarketData): RegimeResult {
    // Compute all 6 signals
    const leverage = this.computeLeverageSentiment(data);
    const smartMoney = this.computeSmartMoneyScore(data);
    const technical = this.computeTechnicalBias(data);
    const narrative = this.computeNarrativeHeat(data);
    const fearGreed = this.computeFearGreedSignal(data);
    const news = this.computeNewsSentiment(data);

    // Build signal breakdown
    const signals: SignalEntry[] = [
      {
        signal: 'Leverage Sentiment (A)',
        rawValue: leverage.rawValue,
        label: leverage.signal,
        score: leverage.score,
        weight: SIGNAL_WEIGHTS.leverageSentiment,
        weightedScore: leverage.score * SIGNAL_WEIGHTS.leverageSentiment,
      },
      {
        signal: 'Smart Money (B)',
        rawValue: smartMoney.rawValue,
        label: smartMoney.signal,
        score: smartMoney.score,
        weight: SIGNAL_WEIGHTS.smartMoney,
        weightedScore: smartMoney.score * SIGNAL_WEIGHTS.smartMoney,
      },
      {
        signal: 'Technical Bias (C)',
        rawValue: technical.rawValue,
        label: technical.signal,
        score: technical.score,
        weight: SIGNAL_WEIGHTS.technicalBias,
        weightedScore: technical.score * SIGNAL_WEIGHTS.technicalBias,
      },
      {
        signal: 'Narrative Heat (D)',
        rawValue: narrative.rawValue,
        label: narrative.signal,
        score: narrative.score,
        weight: SIGNAL_WEIGHTS.narrativeHeat,
        weightedScore: narrative.score * SIGNAL_WEIGHTS.narrativeHeat,
      },
      {
        signal: 'Fear & Greed (E)',
        rawValue: fearGreed.rawValue,
        label: fearGreed.signal,
        score: fearGreed.score,
        weight: SIGNAL_WEIGHTS.fearGreed,
        weightedScore: fearGreed.score * SIGNAL_WEIGHTS.fearGreed,
      },
      {
        signal: 'News Sentiment (F)',
        rawValue: news.rawValue,
        label: news.signal,
        score: news.score,
        weight: SIGNAL_WEIGHTS.newsSentiment,
        weightedScore: news.score * SIGNAL_WEIGHTS.newsSentiment,
      },
    ];

    // Compute composite score
    const compositeScore = signals.reduce((sum, s) => sum + s.weightedScore, 0);

    // Classify regime
    const classification = this.classifyRegime(compositeScore);

    // Detect divergences
    const divergences = this.detectDivergences(leverage.signal, smartMoney.signal, technical.signal, narrative.signal);

    // Compute conviction (1-10)
    let conviction = Math.round(Math.abs(compositeScore) * 10);
    
    // Divergence overrides
    for (const div of divergences) {
      conviction += div.convictionImpact;
    }
    
    // Clamp to 1-10
    conviction = Math.max(1, Math.min(10, conviction));

    const signalBreakdown: SignalBreakdown = {
      signals,
      compositeScore: Math.round(compositeScore * 1000) / 1000,
    };

    return {
      classification,
      compositeScore: Math.round(compositeScore * 1000) / 1000,
      conviction,
      signalBreakdown,
      divergences,
      leverageSentiment: leverage.signal,
      smartMoneySignal: smartMoney.signal,
      technicalBias: technical.signal,
      narrativeHeat: narrative.signal,
      fearGreedSignal: fearGreed.signal,
      newsSentiment: news.signal,
    };
  }

  // ── Regime Classification ─────────────────────────────────────────────

  private classifyRegime(score: number): RegimeClassification {
    if (score >= 0.4) return RegimeClassification.BULL_REGIME;
    if (score >= 0.1) return RegimeClassification.CAUTIOUS_BULL;
    if (score > -0.1) return RegimeClassification.CHOPPY;
    if (score > -0.4) return RegimeClassification.CAUTIOUS_BEAR;
    return RegimeClassification.BEAR_REGIME;
  }

  // ── Divergence Detection ──────────────────────────────────────────────

  private detectDivergences(
    leverage: LeverageSentiment,
    smartMoney: SmartMoneySignal,
    technical: TechnicalBias,
    narrative: NarrativeHeat,
  ): Divergence[] {
    const divergences: Divergence[] = [];

    // TOPPING_SIGNAL: Leverage = GREED but Smart Money = DISTRIBUTION
    if (leverage === LeverageSentiment.GREED && smartMoney === SmartMoneySignal.DISTRIBUTION) {
      divergences.push({
        type: DivergenceType.TOPPING_SIGNAL,
        description: 'Retail leverage is greedy (high funding rates) while smart money is distributing (whale selling + exchange inflows). This is a classic topping pattern — whales exit while retail piles in.',
        convictionImpact: -2,
      });
    }

    // BOTTOMING_SIGNAL: Leverage = FEAR but Smart Money = ACCUMULATION
    if (leverage === LeverageSentiment.FEAR && smartMoney === SmartMoneySignal.ACCUMULATION) {
      divergences.push({
        type: DivergenceType.BOTTOMING_SIGNAL,
        description: 'Retail leverage is fearful (negative funding rates) while smart money is accumulating (whale buying + exchange outflows). This is a classic bottoming pattern — whales buy while retail capitulates.',
        convictionImpact: 2,
      });
    }

    // EARLY_MOVE_SIGNAL: Technical = BULLISH but Narrative = COLD
    if (technical === TechnicalBias.BULLISH && narrative === NarrativeHeat.COLD) {
      divergences.push({
        type: DivergenceType.EARLY_MOVE_SIGNAL,
        description: 'Technical indicators are bullish but the narrative is cold — no hype yet. This suggests an early move before the crowd catches on. Higher risk but potentially higher reward.',
        convictionImpact: 1,
      });
    }

    return divergences;
  }

  // ── Formatting Helpers ────────────────────────────────────────────────

  private formatLargeNumber(num: number): string {
    const abs = Math.abs(num);
    if (abs >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(2);
  }

  // ── Regime Summary ────────────────────────────────────────────────────

  getRegimeSummary(result: RegimeResult): string {
    const emoji: Record<RegimeClassification, string> = {
      [RegimeClassification.BULL_REGIME]: '🟢🚀',
      [RegimeClassification.CAUTIOUS_BULL]: '🟡↗️',
      [RegimeClassification.CHOPPY]: '🟠↔️',
      [RegimeClassification.CAUTIOUS_BEAR]: '🟡↘️',
      [RegimeClassification.BEAR_REGIME]: '🔴📉',
    };

    const lines = [
      `${emoji[result.classification]} REGIME: ${result.classification}`,
      `   Composite Score: ${result.compositeScore.toFixed(3)} (range: -1.0 to +1.0)`,
      `   Conviction: ${result.conviction}/10`,
      '',
      '   Signal Breakdown:',
    ];

    for (const sig of result.signalBreakdown.signals) {
      const scoreStr = sig.score > 0 ? `+${sig.score}` : `${sig.score}`;
      const weightedStr = sig.weightedScore > 0 ? `+${sig.weightedScore.toFixed(3)}` : sig.weightedScore.toFixed(3);
      lines.push(`   ${sig.signal}: ${sig.label} (${scoreStr} × ${sig.weight} = ${weightedStr})`);
    }

    if (result.divergences.length > 0) {
      lines.push('');
      lines.push('   ⚡ DIVERGENCES DETECTED:');
      for (const div of result.divergences) {
        lines.push(`   • ${div.type}: ${div.description.substring(0, 80)}...`);
      }
    }

    return lines.join('\n');
  }
}

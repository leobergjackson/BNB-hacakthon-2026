import { NextResponse } from "next/server";

interface PythonTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  exit_reason: string;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Call the Python FastAPI backend
    const pythonResponse = await fetch("http://127.0.0.1:8000/api/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: payload.asset,
        lookback_days: payload.lookbackBars > 365 ? 365 : payload.lookbackBars,
        risk_profile: payload.riskProfile,
      }),
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      throw new Error(`Python backend error: ${pythonResponse.status} ${errorText}`);
    }

    const pythonData = await pythonResponse.json();
    
    // Check if the backend returned an error
    if (pythonData.status !== "success") {
      throw new Error(pythonData.error_message || "Unknown backend error");
    }

    // Map Python response back to what page.tsx expects
    const mappedResponse = {
      request: payload,
      dataset: {
        source: "coinmarketcap",
        sourceLabel: "CoinMarketCap via Python Agent",
        firstCandle: new Date(Date.now() - (payload.lookbackBars * 24 * 60 * 60 * 1000)).toISOString(),
        lastCandle: new Date().toISOString(),
        candleCount: payload.lookbackBars,
      },
      spec: {
        id: "edi-v2",
        title: pythonData.analysis.strategy_name,
        track: "Track 2",
        generatedAt: pythonData.resource.data_freshness,
        asset: payload.asset,
        timeframe: payload.timeframe,
        objective: pythonData.analysis.cognitive_foundation,
        dataInputs: {
          provider: "CMC/Binance",
          source: "coinmarketcap",
          fields: ["ohlcv", "fng", "funding"],
          candles: payload.lookbackBars,
        },
        assumptions: [],
        indicators: ["Emotional Duality Index v2", "Fear & Greed", "Funding Rates"],
        entryRules: [pythonData.analysis.entry_rules],
        exitRules: [pythonData.analysis.exit_rules],
        riskControls: [pythonData.analysis.risk_management, pythonData.analysis.position_sizing],
        validation: [pythonData.methodology_notes],
        parameters: {
          riskPerTradePct: payload.riskProfile === "aggressive" ? 5 : payload.riskProfile === "balanced" ? 2 : 1,
          maxDrawdownPct: payload.maxDrawdownPct,
        },
      },
      metrics: {
        totalReturnPct: Number(pythonData.backtest_results.total_return_pct.toFixed(2)),
        winRatePct: Number((pythonData.backtest_results.win_rate * 100).toFixed(2)),
        maxDrawdownPct: Number(pythonData.backtest_results.max_drawdown_pct.toFixed(2)),
        sharpeRatio: Number(pythonData.backtest_results.sharpe_ratio.toFixed(2)),
        profitFactor: Number(pythonData.backtest_results.profit_factor.toFixed(2)),
        trades: pythonData.backtest_results.total_trades,
        avgBarsHeld: 0,
        endingEquity: pythonData.backtest_results.final_capital,
      },
      equityCurve: [{ time: new Date().toISOString(), equity: 10000 }], // Mocked for now to avoid breaking UI chart, or map from python if we add it
      trades: pythonData.trade_list.map((t: PythonTrade) => ({
        entryTime: t.entry_date,
        exitTime: t.exit_date,
        entryPrice: t.entry_price,
        exitPrice: t.exit_price,
        quantity: 1, // mocked
        pnl: Number(t.pnl_pct.toFixed(2)),
        returnPct: Number(t.pnl_pct.toFixed(2)),
        reason: t.exit_reason,
        barsHeld: 1,
      })),
      summary: [
        pythonData.action_guidance,
        `Current Signal State: ${pythonData.signal_state.current_direction} (EDI: ${pythonData.signal_state.current_edi_score.toFixed(1)})`
      ]
    };

    return NextResponse.json(mappedResponse);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate strategy report."
      },
      { status: 500 }
    );
  }
}

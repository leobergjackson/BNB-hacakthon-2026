import { NextResponse } from "next/server";
import { createStrategyReport } from "@/lib/report";

// Fully self-contained: computes the strategy spec + no-lookahead backtest in
// TypeScript. Uses CoinMarketCap when CMC_PRO_API_KEY is set, otherwise falls
// back to deterministic demo data — so it runs on a single host (Vercel) with
// no Python backend and no secrets required.
export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const report = await createStrategyReport(payload);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate strategy." },
      { status: 500 }
    );
  }
}

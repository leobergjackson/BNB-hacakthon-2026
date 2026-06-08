"""
Unified Bridge — EDI v2 (Python) + Vantage / RegimeShift (TypeScript)

Fires the Emotional Duality signal engine and the Vantage regime engine on the
same asset, then merges both into a single unified evidence pack with a combined
conviction score and a recommended action.

Design decisions (confirmed):
  D1. Vantage is invoked via `vantage-backend/src/bridge-entry.ts`, which prints
      ONLY JSON to stdout (no banners/markers to parse).
  D2. direction = sign(Vantage compositeScore); tie-break on EDI current_direction.
  D3. If EDI backtest has 0 trades, fall back to the current-signal confidence
      (don't penalise a valid live signal for a quiet historical period).
  D4. EDI "balanced" risk profile maps to Vantage "moderate".

Robustness: the live MCP path needs a real CMC_API_KEY. If the key is missing /
a placeholder, or the live call fails / returns degenerate all-default data, we
fall back to the hand-authored example fixtures and mark `vantage_source`
accordingly so the output is never misleading. Drop a real key into the root
.env (CMC_API_KEY=...) to get live data automatically.

Usage:
    python bridge.py [SYMBOL]        # default BTC
"""

import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
VANTAGE_DIR = ROOT_DIR / "vantage-backend"

# Make EDI modules importable regardless of how this script is launched.
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from cmc_skill import analyze  # noqa: E402  (after sys.path setup)

PLACEHOLDER_KEY = "your_cmc_api_key_here"

# EDI emits these direction strings; normalise to the unified vocabulary.
EDI_DIRECTION_MAP = {
    "bullish_reversal": "BULLISH",
    "bearish_reversal": "BEARISH",
    "no_signal": "NEUTRAL",
}


# ─── CMC key resolution ──────────────────────────────────────────────────────

def _load_cmc_key() -> str | None:
    """Return a *real* CMC_API_KEY (env var or root .env), or None if only a
    placeholder/empty value is available."""
    key = os.getenv("CMC_API_KEY")
    if key and key.strip() and key.strip() != PLACEHOLDER_KEY:
        return key.strip()

    root_env = ROOT_DIR / ".env"
    if root_env.exists():
        for line in root_env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("CMC_API_KEY="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val and val != PLACEHOLDER_KEY:
                    return val
    return None


# ─── Fixture fallback ────────────────────────────────────────────────────────

def _load_fixture(symbol: str, timeframe: str) -> dict | None:
    """Load a hand-authored example strategy spec for offline/demo use."""
    examples = VANTAGE_DIR / "examples"
    if not examples.exists():
        return None
    sym = symbol.lower()
    candidates = [examples / f"{sym}-{timeframe}-output.json"]
    candidates += sorted(examples.glob(f"{sym}-*-output.json"))
    candidates += sorted(examples.glob("*-output.json"))
    for path in candidates:
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
    return None


def _is_degenerate(spec: dict) -> bool:
    """A live call with a bad key can 'succeed' but return all-default data
    (CHOPPY, conviction 1, price 0). Treat that as a failed call."""
    return (
        spec.get("regime") == "CHOPPY"
        and spec.get("conviction", 1) <= 1
        and spec.get("marketDataSnapshot", {}).get("price", 0) in (0, 0.0)
    )


# ─── Vantage invocation ──────────────────────────────────────────────────────

def _run_vantage_live(symbol: str, timeframe: str, cmc_key: str) -> dict:
    """Call vantage-backend/src/bridge-entry.ts and parse its JSON-only stdout."""
    env = {**os.environ, "CMC_API_KEY": cmc_key}
    env.setdefault("CMC_MCP_ENDPOINT", "https://mcp.coinmarketcap.com/mcp")

    # Use the OS trust store for TLS. Fixes "unable to verify the first
    # certificate" on environments whose bundled Node CA list is stale (Node 22+).
    # No-op where Node's bundled CAs already verify the endpoint.
    node_opts = env.get("NODE_OPTIONS", "")
    if "--use-system-ca" not in node_opts:
        env["NODE_OPTIONS"] = (node_opts + " --use-system-ca").strip()

    # Capture BYTES, not text. The child prints UTF-8 (incl. emoji) on stderr;
    # Windows' default cp1252 text decoder cannot handle that and silently yields
    # empty output. shutil.which resolves npx(.cmd) so no shell is needed.
    npx = shutil.which("npx") or "npx"
    proc = subprocess.run(
        [npx, "tsx", "src/bridge-entry.ts",
         "--symbol", symbol, "--timeframe", timeframe, "--risk-profile", "moderate"],
        capture_output=True, cwd=str(VANTAGE_DIR), env=env, timeout=180,
    )

    stdout = proc.stdout.decode("utf-8", errors="replace").strip()
    stderr = proc.stderr.decode("utf-8", errors="replace").strip()

    if proc.returncode != 0:
        raise RuntimeError(f"Vantage exited {proc.returncode}: {stderr[:400]}")
    if not stdout:
        raise RuntimeError("Vantage produced empty stdout")
    return json.loads(stdout)


def _get_vantage_spec(symbol: str, timeframe: str) -> tuple[dict, str]:
    """Return (strategy_spec, source) where source is 'live' or 'fixture'."""
    cmc_key = _load_cmc_key()
    try:
        if not cmc_key:
            raise RuntimeError("no valid CMC_API_KEY (missing or placeholder)")
        spec = _run_vantage_live(symbol, timeframe, cmc_key)
        if _is_degenerate(spec):
            raise RuntimeError("live call returned degenerate all-default data")
        return spec, "live"
    except Exception as exc:  # network / key / parse — fall back to fixture
        fixture = _load_fixture(symbol, timeframe)
        if fixture is None:
            raise RuntimeError(
                f"Vantage live call failed ({exc}) and no fixture available for {symbol}"
            ) from exc
        sys.stderr.write(
            f"[bridge] WARNING: Vantage live unavailable ({exc}); "
            f"using offline example fixture for {symbol}.\n"
        )
        return fixture, "fixture"


# ─── Merge logic ─────────────────────────────────────────────────────────────

def _compute_edi_weight(edi_pack: dict) -> tuple[float, str]:
    """EDI contribution to unified conviction (0-1) and a human-readable note.

    D3: use historical win_rate when trades exist; otherwise fall back to the
    current-signal confidence, and finally to the skill-level confidence (0.85)
    so a quiet backtest window doesn't zero out a valid live signal."""
    if edi_pack.get("status") != "success":
        return 0.0, "edi_unavailable"

    backtest = edi_pack.get("backtest_results", {}) or {}
    total_trades = backtest.get("total_trades", 0) or 0
    if total_trades > 0:
        return float(backtest.get("win_rate", 0) or 0), f"win_rate({total_trades} trades)"

    signal_state = edi_pack.get("signal_state", {}) or {}
    current_conf = signal_state.get("current_confidence")
    if current_conf:  # active live signal carries its own confidence
        return float(current_conf), "current_confidence"
    return float(edi_pack.get("confidence", 0.85) or 0.85), "skill_confidence(no trades)"


def merge(symbol: str, edi_pack: dict, vantage_spec: dict, vantage_source: str) -> dict:
    composite_score = vantage_spec.get("compositeScore", 0) or 0
    conviction_raw = vantage_spec.get("conviction", 1) or 1  # 1-10
    regime = vantage_spec.get("regime", "UNKNOWN")
    divergences = vantage_spec.get("divergencesDetected", []) or []

    # EDI signal state
    signal_state = edi_pack.get("signal_state", {}) if isinstance(edi_pack, dict) else {}
    edi_score_now = signal_state.get("current_edi_score", 0) or 0
    edi_state = "ACTIVE" if edi_score_now and float(edi_score_now) > 0 else "DORMANT"
    if edi_pack.get("status") != "success":
        edi_state = "ERROR"
    edi_dir = EDI_DIRECTION_MAP.get(signal_state.get("current_direction", "no_signal"), "NEUTRAL")

    # D3: EDI weight (0-1) with fallback
    edi_weight, edi_weight_basis = _compute_edi_weight(edi_pack)

    # Unified conviction: EDI 40% + Vantage 60%
    vantage_weight = conviction_raw / 10.0
    unified_conviction = round(edi_weight * 0.4 + vantage_weight * 0.6, 3)

    # D2: direction from compositeScore sign, EDI as tie-break
    if composite_score > 0:
        direction = "BULLISH"
    elif composite_score < 0:
        direction = "BEARISH"
    else:
        direction = edi_dir  # NEUTRAL if EDI has no signal

    # D2: recommended action from thresholds + direction
    if unified_conviction >= 0.7 and direction == "BULLISH":
        action = "BUY"
    elif unified_conviction >= 0.7 and direction == "BEARISH":
        action = "SELL"
    elif unified_conviction >= 0.45:
        action = "HOLD"
    else:
        action = "NO_TRADE"

    div_text = f" + {divergences[0]['type']}" if divergences else ""
    rationale = (
        f"EDI {edi_state}{div_text} | "
        f"Vantage {regime} (conviction {conviction_raw}/10, score {composite_score:+.2f}) | "
        f"Unified {unified_conviction:.2f} ({direction}) → {action}"
    )

    return {
        "symbol": symbol,
        "edi_signal": edi_pack,
        "vantage_regime": vantage_spec,
        "vantage_source": vantage_source,
        "unified_conviction": unified_conviction,
        "direction": direction,
        "recommended_action": action,
        "rationale": rationale,
        "conviction_breakdown": {
            "edi_weight": round(edi_weight, 3),
            "edi_weight_basis": edi_weight_basis,
            "edi_contribution": round(edi_weight * 0.4, 3),
            "vantage_weight": round(vantage_weight, 3),
            "vantage_contribution": round(vantage_weight * 0.6, 3),
        },
    }


# ─── Orchestration ───────────────────────────────────────────────────────────

async def run_bridge(symbol: str = "BTC", timeframe: str = "1d", edi_pack: dict | None = None) -> dict:
    """Run EDI + Vantage on `symbol` and return the unified evidence pack.

    `edi_pack` may be supplied to reuse an already-computed EDI evidence pack
    (e.g. from the Streamlit demo) and avoid recomputing the backtest."""
    symbol = "".join(c for c in symbol if c.isalnum()).upper() or "BTC"
    timeframe = timeframe if timeframe in ("1d", "4h", "1w") else "1d"

    # 1. EDI (reuse if provided)
    if edi_pack is None:
        edi_pack = await analyze(symbol)

    # 2. Vantage (live, else fixture)
    vantage_spec, vantage_source = _get_vantage_spec(symbol, timeframe)

    # 3. Merge
    return merge(symbol, edi_pack, vantage_spec, vantage_source)


if __name__ == "__main__":
    # Resolve relative paths (e.g. EDI's "data" cache) against this dir.
    os.chdir(SCRIPT_DIR)
    sym = sys.argv[1] if len(sys.argv) > 1 else "BTC"
    result = asyncio.run(run_bridge(sym))
    print(json.dumps(result, indent=2, default=str))

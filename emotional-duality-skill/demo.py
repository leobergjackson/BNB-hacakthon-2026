import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as plotly_go
from plotly.subplots import make_subplots
import asyncio
from datetime import datetime, timedelta

from cmc_skill import analyze, EmotionalDualitySkill
from core.data_clients import BinanceClient, FNGClient, FundingClient
from core.edi_signal import compute_edi_v2
from core.backtest import StrategyRules, PositionSizing, PortfolioSimulator
from bridge import run_bridge

# --- PAGE CONFIG ---
st.set_page_config(
    page_title="Emotional Duality Index (EDI v2)",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- CUSTOM CSS ---
st.markdown("""
<style>
    /* Dark background #0a0a0a */
    .stApp {
        background-color: #0a0a0a;
        color: white;
        font-family: 'Inter', system-ui, sans-serif;
    }
    
    /* Card backgrounds #1a1a2e */
    div.css-1r6slb0, div.css-12oz5g7 {
        background-color: #1a1a2e;
        border-radius: 10px;
        padding: 1rem;
    }
    
    /* Metric cards with subtle border-left in gold */
    div[data-testid="stMetric"] {
        background-color: #1a1a2e;
        border-left: 4px solid #F5C518;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    
    /* Text styling */
    h1, h2, h3, h4, h5, h6 {
        color: white !important;
    }
    p, span {
        color: #cccccc;
    }
    
    /* Gold accent #F5C518 for active states */
    .stButton>button {
        background-color: transparent;
        color: #F5C518;
        border: 1px solid #F5C518;
        transition: all 0.3s;
    }
    .stButton>button:hover {
        background-color: #F5C518;
        color: #0a0a0a;
    }
</style>
""", unsafe_allow_html=True)

# --- DATA FETCHING (CACHED) ---
@st.cache_data(ttl=3600)
def fetch_full_data(symbol, lookback_days):
    binance_symbol = f"{symbol.upper()}USDT"
    
    binance = BinanceClient()
    fng = FNGClient(cache_dir="data")
    funding = FundingClient()
    
    price_data = binance.get_historical_ohlcv(binance_symbol, days=lookback_days)
    fng_data = fng.get_historical_fng(days=lookback_days)
    funding_data = funding.get_funding_history(binance_symbol, days=lookback_days)
    
    # Run EDI engine
    edi_results = []
    for idx, row in price_data.iterrows():
        date = row['timestamp'] if 'timestamp' in row else row.name
        
        fng_row = fng_data[fng_data.index == date] if isinstance(fng_data.index, pd.DatetimeIndex) else fng_data[fng_data['timestamp'] == date]
        funding_row = funding_data[funding_data.index == date] if isinstance(funding_data.index, pd.DatetimeIndex) else funding_data[funding_data['timestamp'] == date]
        
        if len(fng_row) == 0:
            continue
            
        fng_hist = fng_data[fng_data.index <= date].tail(14)
        funding_hist = funding_data[funding_data.index <= date].tail(7)
        price_hist = price_data[price_data.index <= date].tail(14) if isinstance(price_data.index, pd.DatetimeIndex) else price_data[price_data['timestamp'] <= date].tail(14)
        
        if len(fng_hist) < 3 or len(price_hist) < 7:
            continue
            
        edi_output = compute_edi_v2(
            fng_history=fng_hist['value'],
            funding_history=funding_hist['fundingRate'] if len(funding_hist) > 0 else pd.Series([]),
            price_history=price_hist['close'] if 'close' in price_hist else price_hist,
            social_sentiment=50.0,
        )
        
        edi_output['date'] = date
        edi_results.append(edi_output)
        
    edi_df = pd.DataFrame(edi_results)
    
    if len(price_data) > 0:
        price_df = price_data.reset_index()
        if 'index' in price_df.columns:
            price_df = price_df.rename(columns={'index': 'date'})
        elif 'timestamp' in price_df.columns:
            price_df = price_df.rename(columns={'timestamp': 'date'})
    else:
        price_df = pd.DataFrame()
        
    return price_df, fng_data, funding_data, edi_df

@st.cache_data(ttl=3600)
def fetch_evidence_pack(symbol, lookback_days):
    return asyncio.run(analyze(symbol, lookback_days=lookback_days, include_backtest=True))


# --- SIDEBAR ---
with st.sidebar:
    st.image("https://cryptologos.cc/logos/bnb-bnb-logo.png", width=50)
    st.title("EDI v2 Control")
    
    symbol = st.selectbox("Asset", ["BTC", "ETH", "BNB"], index=0)
    lookback = st.slider("Lookback Period (Days)", min_value=90, max_value=365, value=365, step=30)
    
    run_btn = st.button("Run Analysis", use_container_width=True)
    
    with st.expander("About the Science"):
        st.markdown("""
        **Larsen/Cacioppo Bivariate Emotion Model**  
        Traditional indicators assume fear and greed are opposite ends of a single spectrum. 
        Cognitive science shows complex systems can hold contradictory emotions simultaneously. 
        EDI v2 detects when the market is experiencing cognitive dissonance — and capitalizes on the inevitable breaking point.
        """)


# --- HEADER SECTION ---
st.title("Emotional Duality Index (EDI v2)")
st.markdown("### When markets feel two things at once, something's about to break.")
st.markdown("*A cognitive science-based trading skill that detects extreme regime disagreement.*")

# Initialize state
if "data_loaded" not in st.session_state:
    st.session_state.data_loaded = False

if run_btn or not st.session_state.data_loaded:
    with st.spinner("Analyzing market psychology and computing duality..."):
        edi_data_error = None
        try:
            price_df, fng_df, funding_df, edi_df = fetch_full_data(symbol, lookback)
        except Exception as e:
            # Market data source unreachable — degrade gracefully (the charts below
            # already guard on empty frames). Failure is not cached, so a later rerun
            # retries once the source is reachable again.
            price_df = fng_df = funding_df = edi_df = pd.DataFrame()
            edi_data_error = str(e)
        try:
            evidence_pack = fetch_evidence_pack(symbol, lookback)
        except Exception as e:
            evidence_pack = {"status": "blocked", "error_message": str(e), "analysis": None}
            edi_data_error = edi_data_error or str(e)

        # Unified bridge: reuse the EDI evidence pack, add Vantage regime confirmation
        try:
            unified = asyncio.run(run_bridge(symbol, timeframe="1d", edi_pack=evidence_pack))
        except Exception as e:
            unified = {"error": str(e)}

        st.session_state.price_df = price_df
        st.session_state.fng_df = fng_df
        st.session_state.funding_df = funding_df
        st.session_state.edi_df = edi_df
        st.session_state.evidence_pack = evidence_pack
        st.session_state.unified = unified
        st.session_state.edi_data_error = edi_data_error
        st.session_state.data_loaded = True

price_df = st.session_state.price_df
fng_df = st.session_state.fng_df
funding_df = st.session_state.funding_df
edi_df = st.session_state.edi_df
pack = st.session_state.evidence_pack
unified = st.session_state.get("unified")
edi_data_error = st.session_state.get("edi_data_error")

if edi_data_error:
    st.warning(
        f"Live EDI market data is temporarily unavailable ({edi_data_error[:140]}). "
        "EDI charts will populate once the data source is reachable — the Vantage regime "
        "confirmation below still renders from the regime engine."
    )

# Top Metrics
col1, col2, col3 = st.columns(3)

curr_fng = fng_df['value'].iloc[-1] if len(fng_df) > 0 else 50
curr_funding = funding_df['fundingRate'].iloc[-1] if len(funding_df) > 0 else 0
is_active = (edi_df['edi_score'].iloc[-1] > 0) if len(edi_df) > 0 else False

with col1:
    st.metric("Current F&G Index", f"{curr_fng:.0f}", "Extreme Greed" if curr_fng > 75 else "Extreme Fear" if curr_fng < 25 else "Neutral")
with col2:
    st.metric("Current Funding Rate", f"{curr_funding:.4%}")
with col3:
    st.metric("EDI Signal Status", "ACTIVE 🟢" if is_active else "DORMANT ⚪")

st.markdown("---")

# --- MAIN CHART: THE DUALITY MAP ---
st.subheader("The Duality Map")

fires = edi_df[edi_df['edi_score'] > 0] if len(edi_df) > 0 else pd.DataFrame()

if len(price_df) > 0 and len(fng_df) > 0:
    fig = make_subplots(rows=3, cols=1, shared_xaxes=True, 
                        vertical_spacing=0.05,
                        row_heights=[0.5, 0.25, 0.25])
    
    # Row 1: Price
    fig.add_trace(plotly_go.Scatter(x=price_df['date'], y=price_df['close'], name="Price", line=dict(color='#cccccc', width=2)), row=1, col=1)
    
    # Row 2: Fear & Greed
    # Color logic for F&G
    fng_df_sorted = fng_df.sort_index() if isinstance(fng_df.index, pd.DatetimeIndex) else fng_df.sort_values('timestamp')
    dates = fng_df_sorted.index if isinstance(fng_df_sorted.index, pd.DatetimeIndex) else fng_df_sorted['timestamp']
    vals = fng_df_sorted['value']
    
    fig.add_trace(plotly_go.Scatter(
        x=dates, y=vals, 
        name="F&G",
        line=dict(color='gray', width=1),
        fill='tozeroy',
        fillcolor='rgba(128,128,128,0.2)'
    ), row=2, col=1)
    
    fig.add_hline(y=75, line_dash="dash", line_color="red", row=2, col=1)
    fig.add_hline(y=25, line_dash="dash", line_color="green", row=2, col=1)
    
    # Row 3: Funding Rate
    fund_df_sorted = funding_df.sort_index() if isinstance(funding_df.index, pd.DatetimeIndex) else funding_df.sort_values('timestamp')
    f_dates = fund_df_sorted.index if isinstance(fund_df_sorted.index, pd.DatetimeIndex) else fund_df_sorted['timestamp']
    f_vals = fund_df_sorted['fundingRate']
    colors = ['#10b981' if v > 0 else '#ef4444' for v in f_vals]
    
    fig.add_trace(plotly_go.Bar(
        x=f_dates, y=f_vals,
        name="Funding Rate",
        marker_color=colors
    ), row=3, col=1)
    
    # Overlay Signals
    for _, fire in fires.iterrows():
        date = fire['date']
        direction = fire['direction']
        y_max = price_df['close'].max()
        
        # Add vertical line
        fig.add_vline(x=date, line_width=2, line_dash="dash", line_color="#F5C518")
        
        # Add annotation
        fig.add_annotation(
            x=date, y=y_max,
            text=f"EDI FIRED: {direction.upper()}",
            showarrow=True, arrowhead=1, arrowcolor="#F5C518",
            arrowsize=2, arrowwidth=2,
            ax=0, ay=-40,
            font=dict(color="#F5C518", size=10, family="Inter"),
            bgcolor="#1a1a2e", bordercolor="#F5C518", borderwidth=1, borderpad=4,
            row=1, col=1
        )
        
    fig.update_layout(
        height=600,
        template="plotly_dark",
        plot_bgcolor="#0a0a0a",
        paper_bgcolor="#0a0a0a",
        margin=dict(l=20, r=20, t=30, b=20),
        showlegend=False,
    )
    
    fig.update_yaxes(title_text="Price", row=1, col=1)
    fig.update_yaxes(title_text="F&G Index", range=[0, 100], row=2, col=1)
    fig.update_yaxes(title_text="Funding", row=3, col=1)
    
    st.plotly_chart(fig, use_container_width=True)

if len(fires) == 0:
    st.info("No emotional duality detected in this period — the market's emotions are aligned. EDI is a sniper strategy and only fires during extreme dissonance.")

# --- VANTAGE REGIME CONFIRMATION (THE UNIFIED SIGNAL) ---
st.markdown("---")
st.subheader("Vantage Regime Confirmation")
st.caption("EDI v2 detects the emotional duality · Vantage confirms the market regime · the two merge into one conviction-weighted call.")

if not unified or unified.get("error"):
    st.warning(f"Unified signal unavailable: {unified.get('error') if unified else 'not computed yet'}")
else:
    vspec = unified.get("vantage_regime", {})
    action = unified.get("recommended_action", "NO_TRADE")
    ACTION_COLORS = {"BUY": "#10b981", "SELL": "#ef4444", "HOLD": "#F5C518", "NO_TRADE": "#888888"}
    REGIME_COLORS = {
        "BULL_REGIME": "#10b981", "CAUTIOUS_BULL": "#84cc16", "CHOPPY": "#888888",
        "CAUTIOUS_BEAR": "#f97316", "BEAR_REGIME": "#ef4444",
    }
    ac = ACTION_COLORS.get(action, "#888888")
    src = unified.get("vantage_source", "live")
    src_badge = "🟢 LIVE (CMC MCP)" if src == "live" else "📦 EXAMPLE FIXTURE"

    # HERO CARD — full width
    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-left:6px solid #F5C518;
                border-radius:12px;padding:22px 28px;margin-bottom:18px;box-shadow:0 4px 14px rgba(0,0,0,0.4);">
      <div style="font-size:13px;color:#888;letter-spacing:3px;font-weight:600;">UNIFIED SIGNAL</div>
      <div style="font-size:52px;font-weight:800;color:{ac};line-height:1.1;margin:2px 0;">{action.replace('_',' ')}</div>
      <div style="font-size:14px;color:#bbb;margin-top:6px;">{unified.get('rationale','')}</div>
      <div style="font-size:12px;color:#666;margin-top:10px;">
        Unified conviction <b style="color:#F5C518;">{unified.get('unified_conviction',0):.2f}</b> &nbsp;·&nbsp;
        Direction <b style="color:#ccc;">{unified.get('direction','—')}</b> &nbsp;·&nbsp;
        Vantage source <b style="color:#ccc;">{src_badge}</b>
      </div>
    </div>
    """, unsafe_allow_html=True)

    regime = vspec.get("regime", "UNKNOWN")
    rc = REGIME_COLORS.get(regime, "#888888")
    score = vspec.get("compositeScore", 0) or 0
    conv = vspec.get("conviction", 0) or 0

    colV1, colV2, colV3 = st.columns(3)

    # LEFT: regime badge + zero-centered composite score bar
    with colV1:
        st.markdown("**Market Regime**")
        st.markdown(
            f'<span style="background:{rc}22;color:{rc};border:1px solid {rc};padding:5px 14px;'
            f'border-radius:14px;font-weight:700;font-size:14px;">{regime.replace("_"," ")}</span>',
            unsafe_allow_html=True,
        )
        marker = (max(-1, min(1, score)) + 1) / 2 * 100
        fill = "#10b981" if score >= 0 else "#ef4444"
        st.markdown(f"""
        <div style="margin-top:16px;font-size:12px;color:#888;">Composite score:
            <b style="color:{fill};">{score:+.2f}</b></div>
        <div style="position:relative;height:10px;background:#2a2a3a;border-radius:5px;margin-top:6px;">
          <div style="position:absolute;left:50%;top:-3px;height:16px;width:2px;background:#555;"></div>
          <div style="position:absolute;left:{marker:.1f}%;top:-4px;height:18px;width:5px;background:{fill};
                      border-radius:2px;transform:translateX(-50%);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#555;margin-top:4px;">
          <span>-1 bear</span><span>0</span><span>+1 bull</span>
        </div>
        """, unsafe_allow_html=True)

    # MIDDLE: conviction gauge + divergence tags
    with colV2:
        st.markdown("**Conviction**")
        st.markdown(
            f'<div style="font-size:44px;font-weight:800;color:#F5C518;line-height:1;">{conv}'
            f'<span style="font-size:18px;color:#888;">/10</span></div>',
            unsafe_allow_html=True,
        )
        divs = vspec.get("divergencesDetected", []) or []
        if divs:
            st.markdown('<div style="margin-top:12px;font-size:12px;color:#888;">Divergence detected</div>',
                        unsafe_allow_html=True)
            for d in divs:
                dt = d.get("type", "")
                dcol = "#10b981" if "BOTTOM" in dt else "#ef4444" if "TOP" in dt else "#F5C518"
                st.markdown(
                    f'<span style="background:{dcol}22;color:{dcol};border:1px solid {dcol};'
                    f'padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;'
                    f'display:inline-block;margin-top:6px;">⚡ {dt.replace("_"," ")}</span>',
                    unsafe_allow_html=True,
                )
        else:
            st.caption("No divergence detected")

    # RIGHT: entry/exit summary
    with colV3:
        st.markdown("**Entry / Exit**")
        trigger = vspec.get("entryRules", {}).get("primaryTrigger", "—")
        trigger_short = (trigger[:115] + "…") if len(trigger) > 115 else trigger
        st.caption(trigger_short)
        tp1 = vspec.get("exitRules", {}).get("takeProfit1", {}).get("percentage", 0) or 0
        sl = vspec.get("exitRules", {}).get("stopLoss", {}).get("percentage", 0) or 0
        m1, m2 = st.columns(2)
        m1.metric("TP1", f"+{tp1:.1f}%")
        m2.metric("Stop", f"-{sl:.1f}%")

    with st.expander("Full Strategy Spec (Vantage regime engine output)"):
        st.json(vspec)

# --- BACKTEST RESULTS & SIGNAL DETAIL ---
if len(fires) > 0 and pack['status'] == 'success':
    st.markdown("---")
    st.subheader("Backtest Results")
    
    b_res = pack['backtest_results']
    
    colA, colB = st.columns([1, 2])
    
    with colA:
        st.metric("Total Return", f"{b_res['total_return_pct']:.2f}%")
        st.metric("Win Rate", f"{b_res['win_rate']:.1f}%")
        st.metric("Total Signals", b_res['total_trades'])
        st.metric("Max Drawdown", f"{b_res['max_drawdown_pct']:.2f}%")
        
        with st.expander("Why so few trades?"):
            st.markdown("*EDI is a sniper, not a machine gun.* It waits for the exact moment when retail sentiment is blindingly extreme while institutional positioning quietly reverses. These moments are rare but high-conviction.")
            
    with colB:
        # Simple Equity Curve
        trade_list = pack['trade_list']
        if len(trade_list) > 0:
            eq_dates = [pack['resource']['data_freshness'][:10]] # Start with current if no trades? 
            # Actually just map trade exits to cumulative return
            eq_df = pd.DataFrame(trade_list)
            eq_df['cumulative_pnl'] = (1 + eq_df['pnl_pct']/100).cumprod() * 10000
            
            # Start point
            start_date = price_df['date'].iloc[0]
            curve_dates = [start_date] + eq_df['exit_date'].tolist()
            curve_vals = [10000] + eq_df['cumulative_pnl'].tolist()
            
            fig_eq = plotly_go.Figure()
            fig_eq.add_trace(plotly_go.Scatter(
                x=curve_dates, y=curve_vals,
                mode='lines+markers', line=dict(color="#F5C518", width=3, shape="hv")
            ))
            fig_eq.update_layout(
                title="Equity Curve ($10,000 Initial)",
                template="plotly_dark", plot_bgcolor="#0a0a0a", paper_bgcolor="#0a0a0a",
                height=300, margin=dict(l=20, r=20, t=40, b=20)
            )
            st.plotly_chart(fig_eq, use_container_width=True)
            
    # Signal Detail Table
    st.subheader("Signal Details")
    st.markdown(f"**Win Rate: {b_res['win_rate']:.1f}%**")
    
    table_data = []
    for t in trade_list:
        pnl = t['pnl_pct']
        outcome = "🟢 Won" if pnl > 0 else "🔴 Lost" if pnl < 0 else "⚪ Breakeven"
        table_data.append({
            "Entry Date": t['entry_date'],
            "Direction": t['type'].upper(),
            "Entry Price": f"${t['entry_price']}",
            "Exit Date": t['exit_date'],
            "Exit Price": f"${t['exit_price']}",
            "PnL": f"{pnl}%",
            "Outcome": outcome
        })
        
    st.dataframe(pd.DataFrame(table_data), use_container_width=True)

# --- EVIDENCE PACK ---
st.markdown("---")
with st.expander("Raw Evidence Pack (CMC Skill Output JSON)"):
    st.json(pack)

# --- FOOTER ---
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #888; padding: 20px;'>
    <p>Built for BNB Hack: AI Trading Agent Edition — Track 2</p>
    <p>By Rupesh Kumar V S | <a href='#' style='color: #F5C518;'>GitHub Repository</a></p>
</div>
""", unsafe_allow_html=True)

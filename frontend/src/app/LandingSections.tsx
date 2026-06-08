'use client'

import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  ArrowUp,
  ArrowRight,
  Flame,
  Scale,
  TrendingDown,
  FileJson,
  Activity,
  Gauge,
  BarChart3,
  Brain,
  Database,
  X,
} from 'lucide-react'

const GOLD = 'linear-gradient(135deg, #f0b90b 0%, #fcd535 100%)'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }

const sectionWrap: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '0 24px' }
const monoEyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em',
  textTransform: 'uppercase', color: '#f0b90b', marginBottom: 14,
}

// ─── TRUST BAR (marquee of data sources) ──────────────────────
export function TrustBar() {
  const sources: Array<[string, string]> = [
    ['CoinMarketCap', '#f0b90b'],
    ['Binance Funding', '#fcd535'],
    ['Alternative.me F&G', '#0ecb81'],
    ['LunarCrush', '#f0b90b'],
    ['BNB Chain', '#fcd535'],
    ['Larsen & Cacioppo', '#eaecef'],
    ['MCP analyze()', '#f0b90b'],
    ['Evidence Pack JSON', '#fcd535'],
  ]
  const row = [...sources, ...sources]
  return (
    <section style={{ background: '#0b0e11', padding: '40px 0', borderTop: '1px solid #2b3139', borderBottom: '1px solid #2b3139', overflow: 'hidden' }}>
      <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#848e9c', margin: '0 0 26px' }}>
        Built on trusted market &amp; sentiment data
      </p>
      <div style={{ position: 'relative', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
        <div className="marquee" style={{ gap: 48 }}>
          {row.map(([name, color], i) => (
            <div key={`${name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, background: color, display: 'inline-block', boxShadow: `0 4px 14px -4px ${color}` }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#b7bdc6' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── HOW IT WORKS (the 3 conditions) ──────────────────────────
export function HowItWorks() {
  const steps = [
    {
      icon: <Flame size={22} color="#0b0e11" />,
      title: 'Sustained sentiment extreme',
      body: 'Retail Fear & Greed must be saturated — above 75 or below 25 — for at least 3 consecutive days. No fleeting spikes.',
    },
    {
      icon: <Scale size={22} color="#0b0e11" />,
      title: 'Derivatives contradiction',
      body: 'Binance funding rates must violently disagree with the crowd — smart money positioned opposite to retail emotion.',
    },
    {
      icon: <TrendingDown size={22} color="#0b0e11" />,
      title: 'Momentum exhaustion',
      body: 'Price momentum stalls or diverges, confirming the trend is running out of fuel right as the contradiction peaks.',
    },
  ]
  return (
    <section id="how-it-works" style={{ background: '#0b0e11', padding: '96px 0' }}>
      <div style={sectionWrap}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={monoEyebrow}>{'// How the signal fires'}</p>
          <h2 style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 900, color: '#eaecef', letterSpacing: '-0.03em', margin: '0 auto', maxWidth: 760 }}>
            Three conditions must align — or EDI stays silent.
          </h2>
          <p style={{ color: '#848e9c', fontSize: 17, margin: '16px auto 0', maxWidth: 560 }}>
            EDI is a sniper, not a machine gun. It refuses to trade until cognitive dissonance is unmistakable.
          </p>
        </motion.div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={stagger}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}
        >
          {steps.map((s, i) => (
            <motion.div key={s.title} variants={fadeUp} className="module-card" style={{
              background: '#181a20', border: '1px solid #2b3139', borderRadius: 18, padding: 32,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: GOLD, display: 'grid', placeItems: 'center', boxShadow: '0 12px 28px -10px rgba(240,185,11,0.6)' }}>
                  {s.icon}
                </div>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 22, color: '#2b3139', lineHeight: 1 }}>0{i + 1}</span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#eaecef', margin: '0 0 10px', letterSpacing: '-0.01em' }}>{s.title}</h3>
              <p style={{ color: '#848e9c', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{s.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── STATS BAR (dot-separated facts) ──────────────────────────
export function StatsBar() {
  const stats: Array<[string, string]> = [
    ['~5', 'high-conviction signals / yr'],
    ['66.7%', 'win rate on ETH'],
    ['3', 'conditions per signal'],
    ['365-day', 'no-lookahead backtest'],
    ['2% / 5% / 3%', 'risk / target / stop'],
  ]
  return (
    <section style={{ background: 'linear-gradient(180deg, #0b0e11 0%, #14171c 100%)', padding: '64px 0', borderTop: '1px solid #2b3139' }}>
      <div style={{ ...sectionWrap, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12, rowGap: 28 }}>
        {stats.map(([value, label], i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div className="gradient-text" style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em' }}>{value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#848e9c', marginTop: 2 }}>{label}</div>
            </div>
            {i < stats.length - 1 && <span style={{ color: '#2b3139', fontSize: 22 }}>·</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── ECOSYSTEM (what the Evidence Pack delivers) ──────────────
export function Ecosystem() {
  const items = [
    { icon: <Activity size={20} />, tone: '#0ecb81', title: 'Signal State', body: 'Direction, confidence (0–0.9), days since last fire, and the active emotional regime.' },
    { icon: <FileJson size={20} />, tone: '#f0b90b', title: 'Evidence Pack JSON', body: 'A strictly typed, machine-readable payload any AI agent can consume via MCP analyze().' },
    { icon: <BarChart3 size={20} />, tone: '#fcd535', title: 'Backtest Metrics', body: 'Total return, win rate, max drawdown, Sharpe, profit factor and full trade log.' },
    { icon: <Brain size={20} />, tone: '#f0b90b', title: 'Market Regime', body: 'Extreme-greed / extreme-fear classification with consecutive-day strength.' },
    { icon: <Gauge size={20} />, tone: '#fcd535', title: 'Risk Protocol', body: '2% risk per trade, 5% target, 3% stop, 14-day time stop, 10% max position.' },
    { icon: <Database size={20} />, tone: '#0ecb81', title: 'Full Audit Trail', body: 'Every data input — CMC, Binance funding, F&G, LunarCrush — recorded for review.' },
  ]
  return (
    <section id="ecosystem" style={{ background: '#0b0e11', padding: '96px 0', borderTop: '1px solid #2b3139' }}>
      <div style={sectionWrap}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={monoEyebrow}>{'// One call, a full decision package'}</p>
          <h2 style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 900, color: '#eaecef', letterSpacing: '-0.03em', margin: '0 auto', maxWidth: 720 }}>
            Everything inside the Evidence Pack.
          </h2>
        </motion.div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={stagger}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}
        >
          {items.map((it) => (
            <motion.div key={it.title} variants={fadeUp} className="module-card" style={{
              background: '#181a20', border: '1px solid #2b3139', borderRadius: 16, padding: 26,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${it.tone}1f`, color: it.tone, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
                {it.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#eaecef', margin: '0 0 8px' }}>{it.title}</h3>
              <p style={{ color: '#848e9c', fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{it.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── FINAL CTA ────────────────────────────────────────────────
export function FinalCTA() {
  return (
    <section style={{ background: '#0b0e11', padding: '40px 0 96px' }}>
      <div style={sectionWrap}>
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeUp}
          className="grain"
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 24, padding: '72px 32px',
            background: GOLD, textAlign: 'center',
            boxShadow: '0 40px 100px -30px rgba(240,185,11,0.5)',
          }}
        >
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 50px)', fontWeight: 900, color: '#0b0e11', letterSpacing: '-0.035em', margin: '0 auto', maxWidth: 740, lineHeight: 1.05 }}>
            Detect the contradiction before the crowd.
          </h2>
          <p style={{ color: 'rgba(11,14,17,0.72)', fontSize: 18, fontWeight: 500, margin: '18px auto 32px', maxWidth: 520 }}>
            Run the interactive Duality Map, inspect the live backtest, and export the Evidence Pack JSON.
          </p>
          <motion.a
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
            href="#dashboard"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#0b0e11', color: '#f0b90b', fontWeight: 800, fontSize: 16,
              padding: '16px 34px', borderRadius: 10, textDecoration: 'none',
              boxShadow: '0 18px 40px -16px rgba(0,0,0,0.5)',
            }}
          >
            Explore the Duality Map <ArrowRight size={18} strokeWidth={2.4} />
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}

// ─── FOOTER ───────────────────────────────────────────────────
export function Footer() {
  const cols: Array<{ title: string; links: Array<[string, string]> }> = [
    { title: 'Strategy', links: [['How It Works', '#how-it-works'], ['Duality Map', '#dashboard'], ['Evidence Pack', '#ecosystem']] },
    { title: 'Data', links: [['CoinMarketCap', 'https://coinmarketcap.com'], ['Binance Funding', 'https://www.binance.com'], ['Alternative.me F&G', 'https://alternative.me/crypto/fear-and-greed-index/']] },
    { title: 'Project', links: [['GitHub', 'https://github.com/leobergjackson/BNB-hacakthon-2026'], ['BNB HACK', '#'], ['Track 2: Strategy Skills', '#']] },
  ]
  return (
    <footer style={{ background: '#0b0e11', color: '#fff', padding: '72px 0 0', position: 'relative', overflow: 'hidden', borderTop: '1px solid #2b3139' }}>
      <div style={{ ...sectionWrap, display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) repeat(3, minmax(0, 1fr))', gap: 40 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 800, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: GOLD, display: 'grid', placeItems: 'center', color: '#0b0e11', fontWeight: 900, fontSize: 13 }}>◆</span>
            Emotional Duality
          </div>
          <p style={{ color: '#848e9c', fontSize: 14.5, lineHeight: 1.65, maxWidth: 320, margin: 0 }}>
            A cognitive-science trading skill for the CoinMarketCap Skills Marketplace. EDI v2 detects sentiment contradictions the crowd can&apos;t see.
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f0b90b', margin: '0 0 16px' }}>{col.title}</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} style={{ color: '#848e9c', fontSize: 14.5, textDecoration: 'none' }}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ ...sectionWrap, marginTop: 56, paddingTop: 28, paddingBottom: 28, borderTop: '1px solid #2b3139', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ color: '#5e6673', fontSize: 13 }}>© 2026 Emotional Duality (EDI v2). Built for BNB HACK.</span>
        <span style={{ color: '#5e6673', fontSize: 13 }}>Not financial advice. Research artifact only.</span>
      </div>

      <div aria-hidden style={{
        textAlign: 'center', fontFamily: 'var(--font-pixel)', fontSize: 'clamp(34px, 11vw, 150px)', fontWeight: 400,
        lineHeight: 0.9, marginTop: 8, color: 'transparent',
        background: 'linear-gradient(180deg, rgba(240,185,11,0.14), rgba(240,185,11,0))',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        userSelect: 'none', paddingBottom: 12,
      }}>
        DUALITY
      </div>
    </footer>
  )
}

// ─── SCROLL TO TOP FAB ────────────────────────────────────────
export function ScrollTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const fn = () => setShow(window.scrollY > 400)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  if (!show) return null
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 60,
        width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: GOLD, color: '#0b0e11', display: 'grid', placeItems: 'center',
        boxShadow: '0 14px 34px -10px rgba(240,185,11,0.7)',
      }}
    >
      <ArrowUp size={20} strokeWidth={2.6} />
    </motion.button>
  )
}

// ─── COOKIE BANNER ────────────────────────────────────────────
export function CookieBanner() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      if (!localStorage.getItem('edi-cookie-ack')) setOpen(true)
    } catch {
      /* localStorage unavailable */
    }
  }, [])
  if (!open) return null
  const dismiss = () => {
    try { localStorage.setItem('edi-cookie-ack', '1') } catch { /* ignore */ }
    setOpen(false)
  }
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 20, zIndex: 60, maxWidth: 380,
      background: '#181a20', border: '1px solid #2b3139', borderRadius: 14,
      padding: '16px 18px', boxShadow: '0 24px 60px -24px rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <p style={{ margin: 0, fontSize: 13.5, color: '#b7bdc6', lineHeight: 1.5 }}>
        This demo uses local storage only to remember this notice. No tracking, no third-party cookies.
      </p>
      <button onClick={dismiss} className="btn-gradient" style={{
        flexShrink: 0, border: 'none', borderRadius: 999, padding: '8px 16px',
        fontSize: 13, fontWeight: 800, color: '#0b0e11', cursor: 'pointer',
      }}>
        Got it
      </button>
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#848e9c', cursor: 'pointer', padding: 2 }}>
        <X size={16} />
      </button>
    </div>
  )
}

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { C, FONT, cardStyle } from '../theme';
import { Skeleton } from './states';

// ─────────────────────────────────────────────────────────────
//  Treasury Overview — the hero band. Total value is the single
//  largest number on the page, with available/deployed breakdown,
//  recent-change delta, APY and a live sparkline (feedback #1).
// ─────────────────────────────────────────────────────────────

interface TreasuryOverviewProps {
  totalBalance: number;
  availableBalance: number;
  deployedBalance: number;
  apy: number;
  balanceSamples: number[];
  tokenSymbol: string;
  loading: boolean;
  demoMode: boolean;
}

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const compact = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontFamily: FONT.mono, fontSize: '0.6rem', fontWeight: 600, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '1.8px', marginBottom: 6,
  }}>
    {children}
  </div>
);

const TreasuryOverview: React.FC<TreasuryOverviewProps> = ({
  totalBalance, availableBalance, deployedBalance, apy, balanceSamples, tokenSymbol, loading, demoMode,
}) => {
  // Honest "recent change": last sample vs first sample we've observed.
  const delta = useMemo(() => {
    if (balanceSamples.length < 2) return 0;
    return balanceSamples[balanceSamples.length - 1] - balanceSamples[0];
  }, [balanceSamples]);

  const chartData = useMemo(() => balanceSamples.map((v, i) => ({ t: i, balance: v })), [balanceSamples]);
  const up = delta >= 0;
  const deltaColor = delta === 0 ? C.secondary : up ? C.green : C.red;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      style={{
        ...cardStyle({ padding: 0, overflow: 'hidden' }),
        // Signature cyan edge + faint inner glow to make it the clear anchor.
        borderLeft: `3px solid ${C.cyan}`,
        background: `linear-gradient(120deg, ${C.card} 0%, ${C.elevated} 55%, ${C.card} 100%)`,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 0 }}>
        {/* ── Left: hero number ── */}
        <div style={{ padding: '24px 28px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ color: C.cyan, fontSize: '1rem' }}>◎</span>
            <span style={{
              fontFamily: FONT.display, fontSize: '0.78rem', fontWeight: 600, color: C.secondary,
              textTransform: 'uppercase', letterSpacing: '2px',
            }}>
              Treasury Overview
            </span>
            {demoMode && (
              <span style={{
                fontFamily: FONT.mono, fontSize: '0.55rem', fontWeight: 700, color: C.amber,
                border: `1px solid ${C.amber}55`, borderRadius: 5, padding: '2px 7px', letterSpacing: '1.5px',
              }}>DEMO</span>
            )}
          </div>

          {loading ? (
            <div>
              <Skeleton width="70%" height={44} radius={8} />
              <Skeleton width="40%" height={16} radius={6} style={{ marginTop: 12 }} />
            </div>
          ) : (
            <>
              <Label>Total Treasury Value</Label>
              <motion.div
                key={Math.round(totalBalance)}
                initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  fontFamily: FONT.display, fontSize: '3rem', fontWeight: 700, color: C.text,
                  letterSpacing: '-1.5px', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums',
                }}
              >
                {usd(totalBalance)}
              </motion.div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {/* recent change */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: FONT.mono, fontSize: '0.78rem', fontWeight: 700, color: deltaColor,
                  background: `${deltaColor}14`, border: `1px solid ${deltaColor}33`,
                  borderRadius: 8, padding: '5px 12px',
                }}>
                  {delta === 0 ? '—' : up ? '▲' : '▼'} {delta === 0 ? 'no movement' : `${up ? '+' : '−'}${compact(Math.abs(delta))}`}
                  <span style={{ color: C.muted, fontWeight: 500, fontSize: '0.62rem' }}>recent</span>
                </span>
                {/* APY */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: `linear-gradient(135deg, ${C.green}18, ${C.cyan}18)`,
                  border: `1px solid ${C.green}33`, borderRadius: 8, padding: '5px 12px',
                }}>
                  <span style={{ fontFamily: FONT.mono, fontWeight: 700, color: C.green, fontSize: '0.8rem' }}>
                    {apy.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '0.62rem', color: C.secondary, fontFamily: FONT.mono }}>APY</span>
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: '0.62rem', color: C.muted, letterSpacing: '1px' }}>
                  {tokenSymbol}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Right: breakdown + sparkline ── */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <Label>Available · Idle</Label>
              {loading ? <Skeleton width="80%" height={24} radius={6} /> : (
                <div style={{ fontFamily: FONT.mono, fontSize: '1.25rem', fontWeight: 700, color: C.blue, fontVariantNumeric: 'tabular-nums' }}>
                  {compact(availableBalance)}
                </div>
              )}
            </div>
            <div>
              <Label>Deployed · Strategies</Label>
              {loading ? <Skeleton width="80%" height={24} radius={6} /> : (
                <div style={{ fontFamily: FONT.mono, fontSize: '1.25rem', fontWeight: 700, color: C.cyan, fontVariantNumeric: 'tabular-nums' }}>
                  {compact(deployedBalance)}
                </div>
              )}
            </div>
          </div>

          {/* allocation bar */}
          {!loading && totalBalance > 0 && (
            <div>
              <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: C.border }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${(availableBalance / totalBalance) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ background: C.blue }}
                />
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${(deployedBalance / totalBalance) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ background: C.cyan }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: FONT.mono, fontSize: '0.58rem', color: C.muted, letterSpacing: '1px' }}>
                <span><span style={{ color: C.blue }}>■</span> IDLE {totalBalance ? Math.round((availableBalance / totalBalance) * 100) : 0}%</span>
                <span><span style={{ color: C.cyan }}>■</span> DEPLOYED {totalBalance ? Math.round((deployedBalance / totalBalance) * 100) : 0}%</span>
              </div>
            </div>
          )}

          {/* sparkline */}
          <div style={{ flex: 1, minHeight: 64 }}>
            {loading ? <Skeleton width="100%" height={64} radius={8} /> : chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={64}>
                <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.cyan} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={['dataMin-50', 'dataMax+50']} />
                  <Tooltip
                    contentStyle={{ background: C.elevated, border: `1px solid ${C.glow}`, borderRadius: 8, padding: '6px 10px' }}
                    labelStyle={{ display: 'none' }}
                    itemStyle={{ color: C.cyan, fontFamily: FONT.mono, fontSize: '0.72rem' }}
                    formatter={(v: number) => [usd(v), 'Balance']}
                  />
                  <Area type="monotone" dataKey="balance" stroke={C.cyan} strokeWidth={2} fill="url(#ovGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ fontFamily: FONT.mono, fontSize: '0.62rem', color: C.muted, paddingTop: 20, textAlign: 'center' }}>
                collecting balance samples…
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default TreasuryOverview;

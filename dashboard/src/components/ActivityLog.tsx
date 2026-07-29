import React from 'react';
import { motion } from 'framer-motion';
import { C, FONT, cardStyle, headingStyle } from '../theme';
import { Activity } from '../hooks/useTreasuryActivity';
import { SkeletonRows, EmptyState, ErrorBanner } from './states';
import { CHAINS, ACTIVE_CHAIN_ID } from '../chainConfig';

// ─────────────────────────────────────────────────────────────
//  Activity Log — real on-chain treasury events with amount,
//  counterparty, gas and status (feedback #3). Honest empty and
//  error states when the chain is quiet or the RPC fails (#4).
// ─────────────────────────────────────────────────────────────

const explorer = (CHAINS[ACTIVE_CHAIN_ID] || CHAINS[968]).explorer;

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const CATEGORY_STYLE: Record<string, { color: string; sign: string }> = {
  in:      { color: C.green, sign: '+' },
  out:     { color: C.red,   sign: '−' },
  neutral: { color: C.blue,  sign: '' },
};

const th: React.CSSProperties = {
  textAlign: 'left', padding: '9px 12px', fontFamily: FONT.mono, fontSize: '0.6rem',
  fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '1.5px', whiteSpace: 'nowrap',
};

const td: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' };

interface ActivityLogProps {
  activities: Activity[];
  loading: boolean;
  error: string | null;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ activities, loading, error }) => (
  <div style={cardStyle()}>
    <div style={headingStyle}>
      <span style={{ color: C.blue, fontSize: '1rem' }}>⊞</span> TREASURY ACTIVITY
      <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: '0.66rem', color: C.muted, letterSpacing: '1px' }}>
        {loading ? 'syncing…' : `${activities.length} event${activities.length === 1 ? '' : 's'}`}
      </span>
    </div>

    {error ? (
      <ErrorBanner tone="warn" title="Activity unavailable" detail={error} />
    ) : loading ? (
      <SkeletonRows rows={5} />
    ) : activities.length === 0 ? (
      <EmptyState
        icon="◎"
        title="No treasury activity yet"
        hint="Proposals, deposits, withdrawals and strategy moves will appear here the moment the swarm acts on-chain."
        accent={C.cyan}
      />
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={th}>Action</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>To / From</th>
              <th style={{ ...th, textAlign: 'right' }}>Gas</th>
              <th style={th}>Block</th>
              <th style={th}>Time</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a, i) => {
              const cat = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.neutral;
              return (
                <motion.tr
                  key={a.key}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  {/* action + tx link */}
                  <td style={td}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text }}>{a.type}</div>
                    <a
                      href={`${explorer}/tx/${a.txHash}`} target="_blank" rel="noreferrer"
                      style={{ fontFamily: FONT.mono, fontSize: '0.62rem', color: C.blue, textDecoration: 'none', opacity: 0.8 }}
                    >
                      {a.txHash.slice(0, 10)}… ↗
                    </a>
                  </td>

                  {/* amount */}
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT.mono, fontSize: '0.78rem', fontWeight: 700, color: a.amount === null ? C.muted : cat.color, fontVariantNumeric: 'tabular-nums' }}>
                    {a.amount === null ? '—' : `${cat.sign}${usd(a.amount)}`}
                  </td>

                  {/* counterparty */}
                  <td style={{ ...td, fontFamily: FONT.mono, fontSize: '0.72rem', color: C.secondary }}>
                    {a.counterparty ? (
                      <span title={a.counterparty}>{short(a.counterparty)}</span>
                    ) : '—'}
                  </td>

                  {/* gas */}
                  <td style={{ ...td, textAlign: 'right', fontFamily: FONT.mono, fontSize: '0.72rem', color: C.secondary, fontVariantNumeric: 'tabular-nums' }}>
                    {a.gas === null ? '—' : `${a.gas.toLocaleString()}`}
                  </td>

                  {/* block */}
                  <td style={{ ...td, fontFamily: FONT.mono, fontSize: '0.72rem', color: C.secondary }}>
                    {a.block.toLocaleString()}
                  </td>

                  {/* time */}
                  <td style={{ ...td, fontSize: '0.72rem', color: C.secondary }}>
                    {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>

                  {/* status */}
                  <td style={td}>
                    <span style={{
                      background: `${C.green}18`, color: C.green, padding: '3px 10px', borderRadius: 6,
                      fontFamily: FONT.mono, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1px',
                    }}>
                      ✓ {a.status}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default ActivityLog;

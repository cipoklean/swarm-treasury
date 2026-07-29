import React from 'react';
import { motion } from 'framer-motion';
import { C, FONT } from '../theme';

// ─────────────────────────────────────────────────────────────
//  Shared loading / empty / error primitives. Every data panel
//  routes through these so the page never looks half-broken when
//  data is unavailable (BotChain feedback #4).
// ─────────────────────────────────────────────────────────────

/** Shimmering placeholder block used while data loads. */
export const Skeleton: React.FC<{ width?: string | number; height?: string | number; radius?: number; style?: React.CSSProperties }> = ({
  width = '100%', height = 14, radius = 6, style,
}) => (
  <div
    className="skeleton-shimmer"
    style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${C.card} 25%, ${C.elevated} 50%, ${C.card} 75%)`,
      backgroundSize: '200% 100%',
      ...style,
    }}
  />
);

/** A stacked set of skeleton rows for table-like panels. */
export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: 12 }}>
        <Skeleton width="18%" height={12} />
        <Skeleton width="30%" height={12} />
        <Skeleton width="22%" height={12} />
        <Skeleton width="14%" height={12} />
      </div>
    ))}
  </div>
);

interface EmptyStateProps {
  icon?: string;
  title: string;
  hint?: string;
  accent?: string;
}

/** Honest "nothing here yet" state — never fake data. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon = '⊘', title, hint, accent = C.muted }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    style={{ textAlign: 'center', padding: '44px 16px', color: C.muted }}
  >
    <div style={{ fontSize: '2rem', marginBottom: 10, color: accent, opacity: 0.8 }}>{icon}</div>
    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.secondary }}>{title}</div>
    {hint && (
      <div style={{ fontSize: '0.72rem', marginTop: 6, lineHeight: 1.5, maxWidth: 340, margin: '6px auto 0' }}>
        {hint}
      </div>
    )}
  </motion.div>
);

interface ErrorBannerProps {
  title: string;
  detail?: string;
  onRetry?: () => void;
  tone?: 'error' | 'warn';
}

/** Inline banner for RPC / wallet / network failures. */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ title, detail, onRetry, tone = 'error' }) => {
  const color = tone === 'error' ? C.red : C.amber;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: `${color}12`, border: `1px solid ${color}44`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 18,
      }}
    >
      <span style={{ fontSize: '1.05rem', color }}>{tone === 'error' ? '⚠' : '◐'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color, fontFamily: FONT.display, letterSpacing: '0.3px' }}>
          {title}
        </div>
        {detail && (
          <div style={{ fontSize: '0.7rem', color: C.secondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {detail}
          </div>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            cursor: 'pointer', border: `1px solid ${color}55`, borderRadius: 8,
            background: `${color}18`, color, fontWeight: 600, fontSize: '0.72rem',
            padding: '6px 14px', fontFamily: FONT.body, whiteSpace: 'nowrap',
          }}
        >
          Retry
        </button>
      )}
    </motion.div>
  );
};

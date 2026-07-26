// Swarm Treasury — Design System
// Single source of truth for colors + type, used across all components

export const C = {
  bg:        '#06080d',
  surface:   '#0d1117',
  card:      '#161b22',
  cardHover: '#1c2330',
  elevated:  '#1e2633',

  blue:      '#58a6ff',
  cyan:      '#39d2c0',
  green:     '#3fb950',
  amber:     '#d29922',
  red:       '#f85149',
  purple:    '#bc8cff',

  text:      '#e6edf3',
  secondary: '#8b949e',
  muted:     '#484f58',

  border:    '#21262d',
  glow:      '#30363d',
} as const;

// Type scale — Space Grotesk for display, Inter for body, JetBrains Mono for data
export const FONT = {
  display: `'Space Grotesk', 'Inter', system-ui, sans-serif`,
  body:    `'Inter', system-ui, -apple-system, sans-serif`,
  mono:    `'JetBrains Mono', ui-monospace, monospace`,
} as const;

export const ROLE_COLORS: Record<string, string> = {
  YIELD_SCOUT: C.blue,
  RISK_GUARD:  C.green,
  EXECUTOR:    C.amber,
  GOVERNOR:    C.red,
};

export const STATUS_STYLES: Record<string, { dot: string; glow: string }> = {
  ONLINE:  { dot: C.green, glow: `0 0 12px ${C.green}66` },
  OFFLINE: { dot: C.red,   glow: `0 0 12px ${C.red}66` },
  THINKING:{ dot: C.amber, glow: `0 0 16px ${C.amber}66` },
  ACTING:  { dot: C.blue,  glow: `0 0 16px ${C.blue}66` },
};

export const cardStyle = (extra?: Record<string, string | number>) => ({
  background: `linear-gradient(145deg, ${C.card} 0%, ${C.elevated} 100%)`,
  borderRadius: '14px',
  border: `1px solid ${C.border}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.25)',
  padding: '24px',
  ...extra,
});

export const headingStyle = {
  fontFamily: FONT.display,
  fontSize: '0.78rem',
  fontWeight: 600,
  color: C.secondary,
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
  marginBottom: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

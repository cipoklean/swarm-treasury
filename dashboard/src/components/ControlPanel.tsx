import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { C } from '../theme';

// Status colors (kept literal so the panel works even if theme tokens shift)
const GREEN = '#3fb950';
const AMBER = '#d29922';
const RED = '#f85149';

type ControlState = { paused: boolean; stop: boolean };

const ControlPanel: React.FC = () => {
  const [state, setState] = useState<ControlState>({ paused: false, stop: false });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/control');
      if (r.ok) setState(await r.json());
    } catch {
      /* server not running — leave last known state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 3000);
    return () => clearInterval(i);
  }, [refresh]);

  const send = async (action: string) => {
    setBusy(true);
    try {
      const r = await fetch('/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (r.ok) setState(await r.json());
    } catch {
      /* ignore network errors */
    }
    setBusy(false);
  };

  const status = state.stop ? 'STOPPED' : state.paused ? 'PAUSED' : 'RUNNING';
  const color = state.stop ? RED : state.paused ? AMBER : GREEN;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      style={{
        background: `${C.card}cc`,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${C.border}`,
        borderRadius: '14px',
        padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.text, letterSpacing: '0.3px' }}>
          Bot Control
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}66` }}
          />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 600, color }}>
            {status}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => send('start')} disabled={busy} style={btn(GREEN)}>▶ Resume</button>
        <button onClick={() => send('pause')} disabled={busy} style={btn(AMBER)}>⏸ Pause</button>
        <button onClick={() => send('stop')} disabled={busy} style={btn(RED)}>⏹ Stop</button>
        <button onClick={() => send('reset')} disabled={busy} style={btnSecondary()}>↺ Reset</button>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: '0.62rem', color: C.muted, fontFamily: 'JetBrains Mono, monospace' }}>
        Wallet-gated controls arrive in Phase 2 — for now anyone with the URL can pause/stop.
      </p>
    </motion.div>
  );
};

const btn = (color: string): React.CSSProperties => ({
  cursor: 'pointer',
  border: `1px solid ${color}55`,
  borderRadius: '9px',
  background: `linear-gradient(135deg, ${color}22, ${color}11)`,
  color,
  fontWeight: 600,
  fontSize: '0.8rem',
  padding: '9px 16px',
  fontFamily: 'Inter, system-ui, sans-serif',
});

const btnSecondary = (): React.CSSProperties => ({
  cursor: 'pointer',
  border: `1px solid ${C.border}`,
  borderRadius: '9px',
  background: C.card,
  color: C.secondary,
  fontWeight: 600,
  fontSize: '0.8rem',
  padding: '9px 16px',
  fontFamily: 'Inter, system-ui, sans-serif',
});

export default ControlPanel;

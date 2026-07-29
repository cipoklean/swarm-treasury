import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C, FONT } from '../theme';

// ─────────────────────────────────────────────────────────────
//  Transaction Confirm Modal — shows amount/target/estimated gas
//  BEFORE sending, then tracks Pending → Confirmed AFTER (feedback
//  #3). Reusable for any wallet-gated write; wired to the
//  Emergency Pause action today.
// ─────────────────────────────────────────────────────────────

type Phase = 'estimating' | 'review' | 'sending' | 'pending' | 'confirmed' | 'error';

interface TxConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  targetLabel: string;
  targetAddress: string;
  explorer: string;
  /** Returns estimated gas units for the pending call. */
  onEstimate: () => Promise<bigint>;
  /** Sends the transaction; resolves with an ethers TransactionResponse. */
  onSend: () => Promise<{ hash: string; wait: () => Promise<any> }>;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
    <span style={{ fontFamily: FONT.mono, fontSize: '0.62rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{label}</span>
    <span style={{ fontFamily: FONT.mono, fontSize: '0.78rem', color: C.text, fontWeight: 600 }}>{children}</span>
  </div>
);

const TxConfirmModal: React.FC<TxConfirmModalProps> = ({
  open, onClose, title, description, targetLabel, targetAddress, explorer, onEstimate, onSend,
}) => {
  const [phase, setPhase] = useState<Phase>('estimating');
  const [gas, setGas] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Reset + estimate each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setPhase('estimating'); setGas(null); setTxHash(null); setErr(null);
    let cancelled = false;
    onEstimate()
      .then((g) => { if (!cancelled) { setGas(g); setPhase('review'); } })
      .catch((e) => { if (!cancelled) { setErr(e?.message || 'Estimation failed'); setPhase('error'); } });
    return () => { cancelled = true; };
  }, [open, onEstimate]);

  const confirm = useCallback(async () => {
    setPhase('sending'); setErr(null);
    try {
      const res = await onSend();
      setTxHash(res.hash);
      setPhase('pending');
      await res.wait();
      setPhase('confirmed');
    } catch (e: any) {
      setErr(e?.message || 'Transaction failed');
      setPhase('error');
    }
  }, [onSend]);

  const busy = phase === 'estimating' || phase === 'sending' || phase === 'pending';
  const shortAddr = targetAddress ? `${targetAddress.slice(0, 8)}…${targetAddress.slice(-6)}` : '—';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={busy ? undefined : onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(3,5,9,0.72)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420, background: `linear-gradient(150deg, ${C.card}, ${C.elevated})`,
              border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 26px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
            }}
          >
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: '1.1rem', color: C.red }}>⚠</span>
              <h3 style={{ margin: 0, fontFamily: FONT.display, fontSize: '1.05rem', fontWeight: 700, color: C.text }}>{title}</h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.76rem', color: C.secondary, lineHeight: 1.5 }}>{description}</p>

            {/* details */}
            <div style={{ background: `${C.surface}aa`, border: `1px solid ${C.border}`, borderRadius: 10, padding: '4px 14px', marginBottom: 16 }}>
              <Row label={targetLabel}><span title={targetAddress}>{shortAddr}</span></Row>
              <Row label="Est. Gas">
                {phase === 'estimating' ? (
                  <span style={{ color: C.muted }}>estimating…</span>
                ) : gas !== null ? (
                  <span style={{ color: C.cyan }}>{gas.toLocaleString()} units</span>
                ) : '—'}
              </Row>
              {txHash && (
                <Row label="Tx Hash">
                  <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: 'none' }}>
                    {txHash.slice(0, 10)}… ↗
                  </a>
                </Row>
              )}
            </div>

            {/* phase-specific status */}
            {phase === 'pending' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: C.amber, fontFamily: FONT.mono, fontSize: '0.72rem' }}>
                <span className="live-blink" style={{ width: 8, height: 8, borderRadius: '50%', background: C.amber }} />
                Pending — waiting for confirmation…
              </div>
            )}
            {phase === 'confirmed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: C.green, fontFamily: FONT.mono, fontSize: '0.72rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}88` }} />
                Confirmed on-chain ✓
              </div>
            )}
            {phase === 'error' && err && (
              <div style={{ marginBottom: 16, color: C.red, fontFamily: FONT.mono, fontSize: '0.7rem', background: `${C.red}12`, border: `1px solid ${C.red}44`, borderRadius: 8, padding: '8px 12px' }}>
                {err}
              </div>
            )}

            {/* actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {phase !== 'confirmed' ? (
                <>
                  <button onClick={onClose} disabled={busy} style={btn(C.secondary, true)}>
                    {busy ? 'Working…' : 'Cancel'}
                  </button>
                  {(phase === 'review' || phase === 'error') && (
                    <button onClick={phase === 'error' ? onClose : confirm} disabled={busy} style={btn(C.red, false)}>
                      {phase === 'error' ? 'Close' : 'Confirm & Send'}
                    </button>
                  )}
                </>
              ) : (
                <button onClick={onClose} style={btn(C.green, false)}>Done</button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const btn = (color: string, ghost: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  border: `1px solid ${ghost ? C.border : color + '66'}`,
  borderRadius: 9,
  background: ghost ? 'transparent' : `linear-gradient(135deg, ${color}26, ${color}12)`,
  color: ghost ? C.secondary : color,
  fontWeight: 700, fontSize: '0.8rem', padding: '9px 18px',
  fontFamily: FONT.body,
});

export default TxConfirmModal;

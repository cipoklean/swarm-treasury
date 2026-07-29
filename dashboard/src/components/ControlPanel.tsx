import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { C, FONT } from '../theme';
import { useWallet } from '../wallet';
import { ADDRESSES, RPC_URL } from '../deployment';
import { ABIS } from '../abis.generated';
import { useControlState } from '../hooks/useControlState';
import { CHAINS, ACTIVE_CHAIN_ID } from '../chainConfig';
import TxConfirmModal from './TxConfirmModal';

const GREEN = '#3fb950';
const AMBER = '#d29922';
const RED = '#f85149';

const explorer = (CHAINS[ACTIVE_CHAIN_ID] || CHAINS[968]).explorer;

const ControlPanel: React.FC = () => {
  const { address, signer, connect, connecting } = useWallet();
  const { state, send } = useControlState();
  const [busy, setBusy] = useState(false);
  const [isGovernor, setIsGovernor] = useState<boolean | null>(null);
  const [govMsg, setGovMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Is the connected wallet the governor/owner? (read-only call)
  useEffect(() => {
    if (!address) {
      setIsGovernor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = new ethers.JsonRpcProvider(RPC_URL);
        const gov = new ethers.Contract(ADDRESSES.Governor, ABIS.governor, p);
        const owner = (await gov.owner()).toLowerCase();
        if (!cancelled) setIsGovernor(owner === address.toLowerCase());
      } catch {
        if (!cancelled) setIsGovernor(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const act = async (action: string) => {
    setBusy(true);
    await send(action);
    setBusy(false);
  };

  // Emergency pause now goes through TxConfirmModal: gas is estimated and
  // shown BEFORE sending, then the tx is tracked Pending → Confirmed AFTER.
  const onEstimate = useCallback(async () => {
    if (!signer) throw new Error('Connect the governor wallet first');
    const gov = new ethers.Contract(ADDRESSES.Governor, ABIS.governor, signer);
    return gov.emergencyPause.estimateGas();
  }, [signer]);

  const onSend = useCallback(async () => {
    if (!signer) throw new Error('Connect the governor wallet first');
    const gov = new ethers.Contract(ADDRESSES.Governor, ABIS.governor, signer);
    const tx = await gov.emergencyPause();
    setGovMsg('Emergency pause sent · tx ' + tx.hash.slice(0, 10) + '…');
    void send('stop');
    return tx;
  }, [signer, send]);

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
        <h3 style={{
          margin: 0, fontFamily: FONT.display, fontSize: '0.95rem', fontWeight: 700,
          color: C.text, letterSpacing: '0.5px',
        }}>
          Bot Control
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}66` }}
          />
          <span style={{ fontFamily: FONT.mono, fontSize: '0.75rem', fontWeight: 600, color }}>
            {status}
          </span>
        </div>
      </div>

      {!address && (
        <button onClick={connect} disabled={connecting} style={btn(GREEN)}>
          {connecting ? 'Connecting…' : 'Connect Wallet to control'}
        </button>
      )}

      {address && isGovernor === false && (
        <div style={{ fontSize: '0.72rem', color: C.muted, fontFamily: FONT.mono }}>
          Connected · not governor (read-only)
        </div>
      )}

      {address && isGovernor && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => act('start')} disabled={busy} style={btn(GREEN)}>▶ Resume</button>
          <button onClick={() => act('pause')} disabled={busy} style={btn(AMBER)}>⏸ Pause</button>
          <button onClick={() => act('stop')} disabled={busy} style={btn(RED)}>⏹ Stop</button>
          <button onClick={() => act('reset')} disabled={busy} style={btnSecondary()}>↺ Reset</button>
          <button onClick={() => setConfirmOpen(true)} disabled={busy} style={btn(RED)}>⚠ Emergency Pause (chain)</button>
        </div>
      )}

      {govMsg && (
        <p style={{ margin: '10px 0 0', fontSize: '0.66rem', color: C.muted, fontFamily: FONT.mono }}>
          {govMsg}
        </p>
      )}

      <TxConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Emergency Pause"
        description="Halts all treasury operations on-chain immediately. This is a guardian safety action — proposals and strategy moves will be blocked until unpaused."
        targetLabel="Governor Contract"
        targetAddress={ADDRESSES.Governor}
        explorer={explorer}
        onEstimate={onEstimate}
        onSend={onSend}
      />
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

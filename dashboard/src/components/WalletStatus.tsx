import React from 'react';
import { motion } from 'framer-motion';
import { C, FONT } from '../theme';
import { useWallet } from '../wallet';
import { CHAINS, ACTIVE_CHAIN_ID } from '../chainConfig';

// ─────────────────────────────────────────────────────────────
//  Wallet Status — prominent connection + network chip (feedback
//  #2). Connection state, address, network name & chain id are
//  always visible; wrong network and wallet errors are surfaced.
// ─────────────────────────────────────────────────────────────

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const WalletStatus: React.FC = () => {
  const { address, chainId, connect, disconnect, connecting, error } = useWallet();
  const chain = CHAINS[ACTIVE_CHAIN_ID] || CHAINS[968];
  const wrongNetwork = address !== null && chainId !== null && chainId !== ACTIVE_CHAIN_ID;

  const dot = address ? (wrongNetwork ? C.amber : C.green) : connecting ? C.amber : C.muted;
  const stateLabel = address ? (wrongNetwork ? 'WRONG NETWORK' : 'CONNECTED') : connecting ? 'CONNECTING…' : 'NOT CONNECTED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: `${C.card}cc`, backdropFilter: 'blur(12px)',
        border: `1px solid ${wrongNetwork ? C.amber : C.border}55`,
        borderRadius: 12, padding: '10px 16px',
      }}>
        {/* connection indicator + address / connect */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            className={address ? 'live-blink' : undefined}
            style={{ width: 8, height: 8, borderRadius: '50%', background: dot, boxShadow: `0 0 8px ${dot}88` }}
          />
          {address ? (
            <button
              onClick={disconnect}
              title="Disconnect"
              style={{
                cursor: 'pointer', border: `1px solid ${C.border}`, borderRadius: 8,
                background: 'transparent', color: C.text, fontWeight: 600, fontSize: '0.8rem',
                padding: '6px 12px', fontFamily: FONT.mono,
              }}
            >
              {short(address)}
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              style={{
                cursor: 'pointer', border: `1px solid ${C.green}66`, borderRadius: 8,
                background: `linear-gradient(135deg, ${C.green}22, ${C.green}11)`,
                color: C.green, fontWeight: 700, fontSize: '0.8rem',
                padding: '6px 14px', fontFamily: FONT.body, opacity: connecting ? 0.6 : 1,
              }}
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 26, background: C.border }} />

        {/* network — always visible */}
        <div>
          <div style={{
            fontFamily: FONT.mono, fontSize: '0.56rem', fontWeight: 600, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '1.6px',
          }}>
            {stateLabel}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: '0.8rem', fontWeight: 700, color: C.blue }}>
            {chain.name.split(' ')[0]} <span style={{ color: C.muted, fontWeight: 500 }}>· {ACTIVE_CHAIN_ID}</span>
          </div>
        </div>
      </div>

      {/* wrong-network warning */}
      {wrongNetwork && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{
            fontFamily: FONT.mono, fontSize: '0.62rem', color: C.amber,
            background: `${C.amber}12`, border: `1px solid ${C.amber}44`,
            borderRadius: 7, padding: '4px 10px',
          }}
        >
          ◐ Switch your wallet to chain {ACTIVE_CHAIN_ID}
        </motion.div>
      )}

      {/* wallet error surfaced inline */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{
            fontFamily: FONT.mono, fontSize: '0.62rem', color: C.red,
            background: `${C.red}12`, border: `1px solid ${C.red}44`,
            borderRadius: 7, padding: '4px 10px', maxWidth: 320, textAlign: 'right',
          }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );
};

export default WalletStatus;

import React, { useState, useEffect } from 'react';
import { C, FONT } from '../theme';

// ─────────────────────────────────────────────────────────────
//  Command Strip — the terminal's top telemetry bar.
//  Dense, always live: block height, control state, agent
//  heartbeat, treasury value and session uptime.
// ─────────────────────────────────────────────────────────────

interface CommandStripProps {
  blockNumber: number;
  networkStatus: string;
  controlState: { paused: boolean; stop: boolean };
  agentsOnline: number;
  agentsTotal: number;
  treasuryValue: number;
  tokenSymbol: string;
}

const Cell: React.FC<{ label: string; children: React.ReactNode; accent?: string }> = ({ label, children, accent }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: '2px',
    padding: '0 18px', borderRight: `1px solid ${C.border}`,
  }}>
    <span style={{
      fontFamily: FONT.mono, fontSize: '0.55rem', fontWeight: 600,
      color: C.muted, textTransform: 'uppercase', letterSpacing: '1.8px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
    <span style={{
      fontFamily: FONT.mono, fontSize: '0.8rem', fontWeight: 600,
      color: accent || C.text, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  </div>
);

const CommandStrip: React.FC<CommandStripProps> = ({
  blockNumber, networkStatus, controlState, agentsOnline, agentsTotal, treasuryValue, tokenSymbol,
}) => {
  const [uptime, setUptime] = useState(0);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
      setClock(new Date().toLocaleTimeString([], { hour12: false }));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const fmtUp = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const ctrl = controlState.stop
    ? { txt: 'STOPPED', color: C.red }
    : controlState.paused
      ? { txt: 'PAUSED', color: C.amber }
      : { txt: 'RUNNING', color: C.green };

  const allOnline = agentsOnline === agentsTotal;

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      borderRadius: '10px',
      marginBottom: '20px',
      overflow: 'hidden',
      padding: '10px 0',
    }}>
      {/* brand cell */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 18px', borderRight: `1px solid ${C.border}`,
      }}>
        <span className="live-blink" style={{
          width: 7, height: 7, borderRadius: '50%',
          background: C.cyan, boxShadow: `0 0 8px ${C.cyan}88`,
        }} />
        <span style={{
          fontFamily: FONT.display, fontWeight: 700, fontSize: '0.72rem',
          color: C.text, letterSpacing: '2px', whiteSpace: 'nowrap',
        }}>
          SWARM://TREASURY
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflowX: 'auto' }}>
        <Cell label="Block">
          <span style={{ color: C.blue }}>#{blockNumber.toLocaleString()}</span>
        </Cell>
        <Cell label="Network">
          <span style={{ color: C.green, fontSize: '0.72rem' }}>{networkStatus}</span>
        </Cell>
        <Cell label="Control">
          <span style={{ color: ctrl.color }}>
            {ctrl.txt === 'RUNNING' ? '●' : ctrl.txt === 'PAUSED' ? '◐' : '○'} {ctrl.txt}
          </span>
        </Cell>
        <Cell label="Agents">
          <span style={{ color: allOnline ? C.green : C.amber }}>
            {agentsOnline}/{agentsTotal} LIVE
          </span>
        </Cell>
        <Cell label="Treasury">
          <span style={{ color: C.cyan }}>
            {treasuryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {tokenSymbol}
          </span>
        </Cell>
        <Cell label="Uptime">
          <span style={{ color: C.secondary }}>{fmtUp(uptime)}</span>
        </Cell>
      </div>

      {/* clock cell */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 18px', borderLeft: `1px solid ${C.border}`,
      }}>
        <span style={{ fontFamily: FONT.mono, fontSize: '0.8rem', fontWeight: 600, color: C.secondary }}>
          {clock || '--:--:--'}
        </span>
      </div>
    </div>
  );
};

export default CommandStrip;

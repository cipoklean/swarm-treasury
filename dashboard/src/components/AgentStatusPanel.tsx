import React from 'react';
import { motion } from 'framer-motion';
import { C, ROLE_COLORS, STATUS_STYLES, cardStyle, headingStyle } from '../theme';

interface Agent { name: string; role: string; address: string; status: string; lastAction: number; }

const roleIcons: Record<string, string> = {
  YIELD_SCOUT: '🔍', RISK_GUARD: '🛡️', EXECUTOR: '⚡', GOVERNOR: '👑',
};

const AgentStatusPanel: React.FC<{ agents: Agent[] }> = ({ agents }) => {
  const ago = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    return `${Math.floor(s/3600)}h`;
  };

  return (
    <div style={cardStyle()}>
      <div style={headingStyle}>
        <span style={{ color: C.blue, fontSize: '1rem' }}>▣</span>
        AGENT SWARM
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: C.green }}>
          {agents.filter(a=>a.status==='ONLINE').length}/{agents.length} LIVE
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {agents.map((agent, i) => {
          const rc = ROLE_COLORS[agent.role] || C.blue;
          const st = STATUS_STYLES[agent.status] || STATUS_STYLES.ONLINE;
          return (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -2, borderColor: `${rc}44` }}
              style={{
                background: `linear-gradient(135deg, ${C.cardHover} 0%, ${C.card} 100%)`,
                borderRadius: '10px',
                padding: '16px',
                border: `1px solid ${C.border}`,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Subtle role color glow */}
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '3px',
                background: `linear-gradient(90deg, ${rc}, transparent)`,
                opacity: 0.6,
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '4px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{roleIcons[agent.role] || '🤖'}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: C.text }}>{agent.name}</span>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: C.muted }}>
                    {agent.address.slice(0,6)}...{agent.address.slice(-4)}
                  </div>
                </div>
                <motion.div
                  animate={agent.status==='ONLINE' ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: st.dot, boxShadow: st.glow, flexShrink: 0,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '1px', color: rc, opacity: 0.8,
                }}>
                  {agent.role.replace('_',' ')}
                </span>
                <span style={{ fontSize: '0.68rem', color: C.secondary }}>{ago(agent.lastAction)} ago</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentStatusPanel;

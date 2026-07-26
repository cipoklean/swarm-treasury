import React from 'react';
import { motion } from 'framer-motion';
import { C, FONT, ROLE_COLORS } from '../theme';

// ─────────────────────────────────────────────────────────────
//  Consensus Pipeline — the swarm's decision flow, live.
//  YIELD SCOUT proposes → RISK GUARD vets → EXECUTOR settles,
//  with the GOVERNOR watching over the whole rail.
// ─────────────────────────────────────────────────────────────

export interface PipelineStage {
  role: string;        // YIELD_SCOUT | RISK_GUARD | EXECUTOR | GOVERNOR
  label: string;
  verb: string;        // what this agent does
  status: string;      // ONLINE | OFFLINE | ...
  count: number;       // actions this session
}

interface PipelineProps {
  stages: PipelineStage[];
  activeFlow: boolean; // true when a proposal is currently moving
}

const roleIcons: Record<string, string> = {
  YIELD_SCOUT: '◉', RISK_GUARD: '◈', EXECUTOR: '▶', GOVERNOR: '◆',
};

const Pipeline: React.FC<PipelineProps> = ({ stages, activeFlow }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: `linear-gradient(180deg, ${C.surface} 0%, ${C.card} 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        padding: '16px 22px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* top hairline accent that lights up when a proposal flows */}
      <div
        className={activeFlow ? 'stream-line' : undefined}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: activeFlow ? undefined : C.border,
          opacity: activeFlow ? 1 : 0.6,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{
          fontFamily: FONT.display, fontSize: '0.68rem', fontWeight: 600,
          color: C.secondary, textTransform: 'uppercase', letterSpacing: '2.5px',
        }}>
          Consensus Rail
        </span>
        <span
          className={activeFlow ? 'live-blink' : undefined}
          style={{
            fontFamily: FONT.mono, fontSize: '0.6rem', fontWeight: 700,
            color: activeFlow ? C.cyan : C.muted,
            border: `1px solid ${activeFlow ? C.cyan + '55' : C.border}`,
            borderRadius: '4px', padding: '1px 8px', letterSpacing: '1.5px',
          }}
        >
          {activeFlow ? '● FLOWING' : '○ IDLE'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0' }}>
        {stages.map((stage, i) => {
          const rc = ROLE_COLORS[stage.role] || C.blue;
          const online = stage.status === 'ONLINE';
          const isLast = i === stages.length - 1;
          return (
            <React.Fragment key={stage.role}>
              {/* node */}
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                style={{
                  flex: isLast ? '0 0 auto' : 1,
                  minWidth: isLast ? '120px' : '140px',
                  background: `linear-gradient(135deg, ${C.cardHover} 0%, ${C.card} 100%)`,
                  border: `1px solid ${online ? rc + '3d' : C.border}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  position: 'relative',
                  cursor: 'default',
                }}
              >
                {/* status dot */}
                <motion.div
                  animate={online ? { scale: [1, 1.35, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: 7, height: 7, borderRadius: '50%',
                    background: online ? C.green : C.red,
                    boxShadow: `0 0 8px ${online ? C.green : C.red}88`,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                  <span style={{ color: rc, fontSize: '0.95rem', lineHeight: 1 }}>{roleIcons[stage.role] || '●'}</span>
                  <span style={{
                    fontFamily: FONT.display, fontWeight: 700, fontSize: '0.78rem',
                    color: C.text, letterSpacing: '0.5px',
                  }}>
                    {stage.label}
                  </span>
                </div>
                <div style={{
                  fontFamily: FONT.mono, fontSize: '0.6rem', color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px',
                }}>
                  {stage.verb}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                  <span style={{
                    fontFamily: FONT.mono, fontWeight: 700, fontSize: '1.05rem', color: rc,
                  }}>
                    {stage.count}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: C.secondary }}>actions</span>
                </div>
              </motion.div>

              {/* connector */}
              {!isLast && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', flex: '0 0 34px' }}>
                  <div
                    className={activeFlow ? 'stream-line' : undefined}
                    style={{
                      width: '100%', height: '2px', borderRadius: '1px',
                      background: activeFlow ? undefined : C.glow,
                      position: 'relative',
                    }}
                  >
                    <span style={{
                      position: 'absolute', right: '-3px', top: '50%', transform: 'translateY(-50%)',
                      width: 0, height: 0,
                      borderTop: '4px solid transparent', borderBottom: '4px solid transparent',
                      borderLeft: `6px solid ${activeFlow ? C.cyan : C.glow}`,
                    }} />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Pipeline;

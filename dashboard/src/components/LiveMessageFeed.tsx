import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { C, cardStyle, headingStyle } from '../theme';
import { AGENT_COLORS } from '../hooks/useBlockchain';

interface Message {
  messageId: number; proposalId: number; agentRole: number;
  messageType: number; blockNumber: number; dataHash: string;
  timestamp: number; agentName: string; actionType: string;
}

const LiveMessageFeed: React.FC<{ messages: Message[]; isLoading: boolean }> = ({ messages, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // Stick-to-bottom: only auto-scroll the feed container itself (never the page).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const agentNames: Record<number, string> = { 1:'Yield Scout', 2:'Risk Guard', 3:'Executor', 4:'Governor' };
  const typeBadge: Record<string, { color: string; bg: string }> = {
    PROPOSAL:  { color: C.blue,  bg: `${C.blue}18` },
    APPROVAL:  { color: C.green, bg: `${C.green}18` },
    VETO:      { color: C.red,   bg: `${C.red}18` },
    EXECUTED:  { color: C.purple,bg: `${C.purple}18` },
  };

  return (
    <div style={{ ...cardStyle(), maxHeight: '460px', display: 'flex', flexDirection: 'column' }}>
      <div style={headingStyle}>
        <span style={{ color: C.cyan, fontSize: '1rem' }}>◈</span>
        MESSAGE BUS
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: C.muted }}>
          {messages.length} events
        </span>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 24, height: 24, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.blue }} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📡</div>
              <div style={{ fontSize: '0.85rem' }}>Listening for agent messages...</div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const ac = AGENT_COLORS[String(msg.agentRole)] || C.blue;
              const badge = typeBadge[msg.actionType] || typeBadge.PROPOSAL;
              return (
                <motion.div
                  key={msg.messageId} layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: `${ac}0a`,
                    borderLeft: `3px solid ${ac}`,
                    padding: '10px 14px',
                    marginBottom: '8px',
                    borderRadius: '0 8px 8px 0',
                    position: 'relative',
                  }}
                >
                  {i === 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        position: 'absolute', top: '6px', right: '10px',
                        background: C.green, color: C.bg,
                        padding: '2px 8px', borderRadius: '4px',
                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1px',
                      }}
                    >LIVE</motion.div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: ac }}>
                      {agentNames[msg.agentRole] || msg.agentName}
                    </span>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      padding: '2px 8px', borderRadius: '4px',
                      fontSize: '0.62rem', fontWeight: 600, letterSpacing: '1px',
                    }}>
                      {msg.actionType}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: C.muted }}>
                    Proposal #{msg.proposalId} &nbsp;·&nbsp; Block #{msg.blockNumber.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: C.secondary, marginTop: '2px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default LiveMessageFeed;

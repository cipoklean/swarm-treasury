import React from 'react';
import { motion } from 'framer-motion';
import { C, cardStyle, headingStyle } from '../theme';

// ════════════════════════════════════════════════════════════
//  Governor Panel — pending approvals
// ════════════════════════════════════════════════════════════

interface PendingApproval { proposalId:number; amount:number; strategy:string; expectedApy:number; simulatedSlippage:number; timeLeft:number; }

export const GovernorPanel: React.FC<{ pendingApprovals: PendingApproval[] }> = ({ pendingApprovals }) => (
  <div style={cardStyle()}>
    <div style={headingStyle}>
      <span style={{ color:C.red, fontSize:'1rem' }}>◆</span> PENDING APPROVALS
    </div>
    {pendingApprovals.length === 0 ? (
      <div style={{ textAlign:'center', padding:'40px 0', color:C.muted }}>
        <div style={{ fontSize:'2rem', marginBottom:'8px' }}>✓</div>
        <div style={{ fontSize:'0.85rem' }}>No pending approvals</div>
      </div>
    ) : (
      pendingApprovals.map(pa=>(
        <motion.div key={pa.proposalId} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          style={{
            background:`linear-gradient(135deg, ${C.cardHover}, ${C.card})`,
            borderRadius:'10px', padding:'16px', marginBottom:'10px',
            border:`1px solid ${C.border}`,
          }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'0.8rem', color:C.blue }}>
              #{pa.proposalId}
            </span>
            <span style={{ fontSize:'0.7rem', color:C.red }}>
              ⏱ {pa.timeLeft}s left
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <div style={{ fontSize:'0.6rem', color:C.muted, textTransform:'uppercase', letterSpacing:'1px' }}>Amount</div>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'0.85rem', color:C.text, fontWeight:600 }}>
                ${pa.amount.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize:'0.6rem', color:C.muted, textTransform:'uppercase', letterSpacing:'1px' }}>Expected APY</div>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'0.85rem', color:C.green, fontWeight:600 }}>
                {pa.expectedApy}%
              </div>
            </div>
          </div>
          <div style={{ marginTop:'8px' }}>
            <div style={{ fontSize:'0.6rem', color:C.muted, textTransform:'uppercase', letterSpacing:'1px' }}>Strategy</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'0.72rem', color:C.secondary }}>
              {pa.strategy.slice(0,6)}...{pa.strategy.slice(-4)}
            </div>
          </div>
          <div style={{ marginTop:'8px', height:'4px', background:C.border, borderRadius:'2px', overflow:'hidden' }}>
            <motion.div
              initial={{ width:'100%' }}
              animate={{ width:'0%' }}
              transition={{ duration:pa.timeLeft, ease:'linear' }}
              style={{ height:'100%', background:`linear-gradient(90deg, ${C.red}, ${C.amber})`, borderRadius:'2px' }}
            />
          </div>
        </motion.div>
      ))
    )}
  </div>
);

import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { C, cardStyle, headingStyle } from '../theme';

// ════════════════════════════════════════════════════════════
//  Treasury Metrics — balance, projected, APY, sparkline
// ════════════════════════════════════════════════════════════

interface TreasuryMetricsProps { balance: number; projectedBalance: number; apy: number; balanceHistory: number[]; }

export const TreasuryMetrics: React.FC<TreasuryMetricsProps> = ({ balance, projectedBalance, apy, balanceHistory }) => {
  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 }).format(v);
  const chartData = balanceHistory.map((v,i) => ({ t:i, balance:v }));

  return (
    <div style={cardStyle()}>
      <div style={headingStyle}>
        <span style={{ color: C.cyan, fontSize: '1rem' }}>◎</span> TREASURY
      </div>

      {/* Big numbers */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
        <div>
          <div style={{ fontSize:'0.65rem', fontWeight:600, color:C.secondary, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'4px' }}>
            Current Balance
          </div>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'1.5rem', fontWeight:700, color:C.text }}>
            {fmt(balance)}
          </div>
        </div>
        <div>
          <div style={{ fontSize:'0.65rem', fontWeight:600, color:C.secondary, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'4px' }}>
            Projected (12mo)
          </div>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'1.5rem', fontWeight:700, color:C.cyan }}>
            {fmt(projectedBalance)}
          </div>
        </div>
      </div>

      {/* APY badge */}
      <motion.div
        initial={{ scale:0.9, opacity:0 }}
        animate={{ scale:1, opacity:1 }}
        transition={{ delay:0.3 }}
        style={{
          display:'inline-flex', alignItems:'center', gap:'8px',
          background:`linear-gradient(135deg, ${C.green}18, ${C.cyan}18)`,
          border:`1px solid ${C.green}33`, borderRadius:'8px',
          padding:'8px 16px', marginBottom:'16px',
        }}
      >
        <span style={{ fontSize:'0.9rem' }}>📈</span>
        <span style={{ fontWeight:700, color:C.green, fontFamily:'JetBrains Mono, monospace' }}>{apy.toFixed(1)}%</span>
        <span style={{ fontSize:'0.7rem', color:C.secondary }}>APY</span>
      </motion.div>

      {/* Area chart */}
      <div style={{ height:'120px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top:0, right:0, left:0, bottom:0 }}>
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.cyan} stopOpacity={0.25}/>
                <stop offset="100%" stopColor={C.cyan} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} strokeOpacity={0.5}/>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={['dataMin-200','dataMax+200']} />
            <Tooltip
              contentStyle={{ background:C.elevated, border:`1px solid ${C.glow}`, borderRadius:'8px', padding:'8px 12px' }}
              labelStyle={{ color:C.secondary, fontSize:'0.7rem' }}
              itemStyle={{ color:C.cyan, fontFamily:'JetBrains Mono, monospace', fontSize:'0.8rem' }}
              formatter={(v:number)=>[`$${(v/1000).toFixed(1)}K`,'Balance']}
              labelFormatter={()=>''}
            />
            <Area type="monotone" dataKey="balance" stroke={C.cyan} strokeWidth={2} fill="url(#balanceGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  Block Time Ticker
// ════════════════════════════════════════════════════════════

interface BlockTimeTickerProps { blockNumber: number; blockTime: number; networkStatus: string; }

export const BlockTimeTicker: React.FC<BlockTimeTickerProps> = ({ blockNumber, blockTime, networkStatus }) => (
  <motion.div
    initial={{ opacity:0, y:-10 }}
    animate={{ opacity:1, y:0 }}
    style={{
      display:'flex', justifyContent:'center', gap:'24px',
      padding:'8px 0', marginBottom:'8px',
    }}
  >
    {[
      { label:'NETWORK', value:networkStatus, color:C.green },
      { label:'BLOCK', value:`#${blockNumber.toLocaleString()}`, color:C.blue },
      { label:'BLOCK TIME', value:`${blockTime}s`, color:C.secondary },
    ].map(item=>(
      <div key={item.label} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
        <span style={{ fontSize:'0.6rem', fontWeight:600, color:C.muted, textTransform:'uppercase', letterSpacing:'1.5px' }}>
          {item.label}
        </span>
        <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'0.8rem', fontWeight:600, color:item.color }}>
          {item.value}
        </span>
      </div>
    ))}
  </motion.div>
);

// ════════════════════════════════════════════════════════════
//  Transaction Log
// ════════════════════════════════════════════════════════════

interface Transaction { txHash:string; action:string; amount:number; block:number; time:number; gas:number; status:'PENDING'|'CONFIRMED'|'FAILED'; }

const statusStyle: Record<string, { color:string; bg:string }> = {
  CONFIRMED: { color:C.green, bg:`${C.green}18` },
  PENDING:   { color:C.amber, bg:`${C.amber}18` },
  FAILED:    { color:C.red,   bg:`${C.red}18` },
};

export const TransactionLog: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => (
  <div style={cardStyle()}>
    <div style={headingStyle}>
      <span style={{ color:C.blue, fontSize:'1rem' }}>⊞</span> TRANSACTION LOG
    </div>
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {['TX HASH','ACTION','AMOUNT','BLOCK','TIME','STATUS'].map(h=>(
              <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:'0.6rem', fontWeight:600, color:C.muted, textTransform:'uppercase', letterSpacing:'1.5px' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx,i)=>(
            <motion.tr key={tx.txHash} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
              style={{ borderBottom:`1px solid ${C.border}` }}>
              <td style={{ padding:'10px 12px', fontFamily:'JetBrains Mono, monospace', fontSize:'0.78rem', color:C.blue }}>
                {tx.txHash.slice(0,6)}...{tx.txHash.slice(-4)}
              </td>
              <td style={{ padding:'10px 12px', fontSize:'0.8rem', color:C.text }}>{tx.action}</td>
              <td style={{ padding:'10px 12px', fontFamily:'JetBrains Mono, monospace', fontSize:'0.78rem', color:C.text }}>
                ${tx.amount.toLocaleString()}
              </td>
              <td style={{ padding:'10px 12px', fontFamily:'JetBrains Mono, monospace', fontSize:'0.78rem', color:C.secondary }}>
                {tx.block.toLocaleString()}
              </td>
              <td style={{ padding:'10px 12px', fontSize:'0.75rem', color:C.secondary }}>
                {new Date(tx.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
              </td>
              <td style={{ padding:'10px 12px' }}>
                <span style={{
                  background: statusStyle[tx.status]?.bg || `${C.muted}18`,
                  color: statusStyle[tx.status]?.color || C.muted,
                  padding:'3px 10px', borderRadius:'6px',
                  fontSize:'0.62rem', fontWeight:700, letterSpacing:'1px',
                }}>
                  {tx.status}
                </span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

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

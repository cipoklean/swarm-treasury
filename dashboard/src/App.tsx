import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AgentStatusPanel from './components/AgentStatusPanel';
import ControlPanel from './components/ControlPanel';
import { ConnectButton } from './wallet';
import LiveMessageFeed from './components/LiveMessageFeed';
import { TreasuryMetrics, TransactionLog, GovernorPanel, BlockTimeTicker } from './components';
import { useBlockchain, useAgentMessages } from './hooks/useBlockchain';
import { C } from './theme';
import { DEPLOYED_ADDRESSES, ACTIVE_CHAIN_ID, CHAINS } from './chainConfig';

const chain = CHAINS[ACTIVE_CHAIN_ID] || CHAINS[31337];
const addresses = DEPLOYED_ADDRESSES[ACTIVE_CHAIN_ID as keyof typeof DEPLOYED_ADDRESSES];

const App: React.FC = () => {
  const { blockNumber, blockTime, networkStatus, demoMode, treasuryBalance, apy } = useBlockchain();
  const { messages, isLoading } = useAgentMessages();

  const [agents] = useState([
    { name:'Yield Scout', role:'YIELD_SCOUT', address:addresses?.AgentRegistry || '0x0', status:'ONLINE', lastAction:Date.now() },
    { name:'Risk Guard',  role:'RISK_GUARD',  address:addresses?.AgentRegistry || '0x0', status:'ONLINE', lastAction:Date.now() },
    { name:'Executor',    role:'EXECUTOR',    address:addresses?.AgentRegistry || '0x0', status:'ONLINE', lastAction:Date.now() },
    { name:'Governor',    role:'GOVERNOR',    address:addresses?.Governor || '0x0',       status:'ONLINE', lastAction:Date.now() },
  ]);

  const [treasuryData, setTreasuryData] = useState({
    balance: 100000, projectedBalance: 112000, apy: 12,
    balanceHistory: Array.from({length:24}, (_,i) => 96000 + i * 400 + Math.random() * 800),
  });

  const [transactions] = useState([
    { txHash:'0xabc123def456', action:'Deposit', amount:10000, block:12345, time:Date.now()-300000, gas:21000, status:'CONFIRMED' as const },
    { txHash:'0x789ghi012jkl', action:'Strategy Deposit', amount:5000, block:12346, time:Date.now()-180000, gas:150000, status:'CONFIRMED' as const },
    { txHash:'0x345mno678pqr', action:'Harvest Yield', amount:1200, block:12347, time:Date.now()-90000, gas:95000, status:'CONFIRMED' as const },
  ]);

  const [pendingApprovals] = useState([
    { proposalId:1, amount:20000, strategy:addresses?.MockStrategy||'0x0', expectedApy:12, simulatedSlippage:0.005, timeLeft:30 },
  ]);

  // Simulate updates
  useEffect(() => {
    const i = setInterval(() => {
      setTreasuryData(p=>({
        ...p, balance:p.balance+Math.floor(Math.random()*50),
        projectedBalance:p.projectedBalance+Math.floor(Math.random()*60),
        balanceHistory:[...p.balanceHistory.slice(1), p.balanceHistory[p.balanceHistory.length-1]+Math.floor(Math.random()*100)],
      }));
    }, 4000);
    return ()=>clearInterval(i);
  }, []);

  return (
    <div style={{
      minHeight:'100vh', padding:'24px 32px', maxWidth:'1440px', margin:'0 auto',
      fontFamily:"'Inter', system-ui, sans-serif",
    }}>
      {/* ── Header ── */}
      <motion.header initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} transition={{duration:0.6}}
        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'2rem', fontWeight:800, color:C.text, letterSpacing:'-0.5px', margin:0 }}>
            <span style={{
              background:`linear-gradient(135deg, ${C.blue}, ${C.cyan})`,
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>
              SWARM TREASURY
            </span>
          </h1>
          <p style={{ fontSize:'0.75rem', color:C.secondary, margin:'4px 0 0', letterSpacing:'0.5px' }}>
            {chain.name} &nbsp;·&nbsp; Multi-Agent Autonomous Treasury
          </p>
          {demoMode && (
            <span style={{ marginLeft:'10px', fontSize:'0.6rem', fontWeight:700, color:'#d29922', border:`1px solid #d2992255`, borderRadius:'6px', padding:'2px 8px', letterSpacing:'1px' }}>DEMO</span>
          )}
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:'10px',
          background:`${C.card}aa`, backdropFilter:'blur(12px)',
          border:`1px solid ${C.border}`, borderRadius:'10px',
          padding:'10px 18px',
        }}>
          <ConnectButton />
          <motion.div
            animate={{ scale:[1,1.15,1] }} transition={{ duration:2, repeat:Infinity }}
            style={{ width:8, height:8, borderRadius:'50%', background:C.green, boxShadow:`0 0 10px ${C.green}66` }}
          />
          <div>
            <div style={{ fontSize:'0.65rem', fontWeight:600, color:C.muted, textTransform:'uppercase', letterSpacing:'1.5px' }}>
              {chain.name}
            </div>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'0.8rem', fontWeight:600, color:C.text }}>
              Block #{blockNumber.toLocaleString()}
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Block Ticker ── */}
      <BlockTimeTicker blockNumber={blockNumber} blockTime={blockTime} networkStatus={networkStatus} />

      {/* ── Bot Control (Phase 1: start / pause / stop) ── */}
      <div style={{ marginBottom: '20px' }}>
        <ControlPanel />
      </div>

      {/* ── Top Row: Agents + Treasury ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
        <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:0.1,duration:0.5}}>
          <AgentStatusPanel agents={agents} />
        </motion.div>
        <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} transition={{delay:0.15,duration:0.5}}>
          <TreasuryMetrics
            balance={treasuryBalance}
            projectedBalance={Math.round(treasuryBalance * (1 + apy / 100))}
            apy={apy}
            balanceHistory={treasuryData.balanceHistory}
          />
        </motion.div>
      </div>

      {/* ── Middle Row: Messages + Governor ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'20px', marginBottom:'20px' }}>
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}}>
          <LiveMessageFeed messages={messages} isLoading={isLoading} />
        </motion.div>
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.25}}>
          <GovernorPanel pendingApprovals={pendingApprovals} />
        </motion.div>
      </div>

      {/* ── Bottom: Transaction Log ── */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}}>
        <TransactionLog transactions={transactions} />
      </motion.div>

      {/* ── Footer ── */}
      <div style={{
        textAlign:'center', padding:'24px 0 8px',
        fontFamily:'JetBrains Mono, monospace', fontSize:'0.65rem', color:C.muted,
      }}>
        <div>
          Vault · <span style={{color:C.blue}}>{addresses?.TreasuryVault?.slice(0,6)}...{addresses?.TreasuryVault?.slice(-4)}</span>
          &nbsp; Registry · <span style={{color:C.cyan}}>{addresses?.AgentRegistry?.slice(0,6)}...{addresses?.AgentRegistry?.slice(-4)}</span>
          &nbsp; Bus · <span style={{color:C.purple}}>{addresses?.MessageBus?.slice(0,6)}...{addresses?.MessageBus?.slice(-4)}</span>
        </div>
      </div>
    </div>
  );
};

export default App;

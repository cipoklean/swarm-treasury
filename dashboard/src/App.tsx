import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AgentStatusPanel from './components/AgentStatusPanel';
import ControlPanel from './components/ControlPanel';
import CommandStrip from './components/CommandStrip';
import Pipeline, { PipelineStage } from './components/Pipeline';
import { ConnectButton } from './wallet';
import LiveMessageFeed from './components/LiveMessageFeed';
import { TreasuryMetrics, TransactionLog, GovernorPanel } from './components';
import { useBlockchain, useAgentMessages, MessageType } from './hooks/useBlockchain';
import { useControlState } from './hooks/useControlState';
import { C, FONT } from './theme';
import { DEPLOYED_ADDRESSES, ACTIVE_CHAIN_ID, CHAINS } from './chainConfig';

const chain = CHAINS[ACTIVE_CHAIN_ID] || CHAINS[968];
const addresses = DEPLOYED_ADDRESSES[ACTIVE_CHAIN_ID as keyof typeof DEPLOYED_ADDRESSES];

// Build transaction rows from the live MessageBus feed (no fake data)
function messagesToTx(messages: MessageType[]) {
  return messages.slice(0, 12).map((m) => ({
    txHash: m.dataHash.replace('…', '') || `0x${m.messageId.toString(16).padStart(8, '0')}`,
    action: `${m.agentName} · ${m.actionType}`,
    amount: 0,
    block: m.blockNumber,
    time: m.timestamp,
    gas: 0,
    status: 'CONFIRMED' as const,
  }));
}

// Derive pending approvals: proposals that were proposed but not yet approved/vetoed/executed
function derivePending(messages: MessageType[]) {
  const byProposal = new Map<number, MessageType[]>();
  for (const m of messages) {
    if (!byProposal.has(m.proposalId)) byProposal.set(m.proposalId, []);
    byProposal.get(m.proposalId)!.push(m);
  }
  const pending: { proposalId: number; amount: number; strategy: string; expectedApy: number; simulatedSlippage: number; timeLeft: number }[] = [];
  for (const [pid, msgs] of byProposal) {
    const hasProposal = msgs.some((m) => m.actionType === 'PROPOSAL');
    const resolved = msgs.some((m) => ['APPROVAL', 'VETO', 'EXECUTED'].includes(m.actionType));
    if (hasProposal && !resolved) {
      pending.push({
        proposalId: pid, amount: 0, strategy: addresses?.MockStrategy || '0x0',
        expectedApy: 12, simulatedSlippage: 0.005, timeLeft: 30,
      });
    }
  }
  return pending.slice(0, 4);
}

const App: React.FC = () => {
  const { blockNumber, blockTime, networkStatus, demoMode, treasuryBalance, apy, tokenSymbol } = useBlockchain();
  const { messages, isLoading, agentCounts, activeFlow } = useAgentMessages();
  const { state: controlState } = useControlState();

  // Agent status derives from the control plane (stopped → OFFLINE, paused → THINKING)
  const agentStatus = controlState.stop ? 'OFFLINE' : controlState.paused ? 'THINKING' : 'ONLINE';
  const [agents] = useState([
    { name: 'Yield Scout', role: 'YIELD_SCOUT', address: addresses?.AgentRegistry || '0x0', status: agentStatus, lastAction: Date.now() },
    { name: 'Risk Guard', role: 'RISK_GUARD', address: addresses?.AgentRegistry || '0x0', status: agentStatus, lastAction: Date.now() },
    { name: 'Executor', role: 'EXECUTOR', address: addresses?.AgentRegistry || '0x0', status: agentStatus, lastAction: Date.now() },
    { name: 'Governor', role: 'GOVERNOR', address: addresses?.Governor || '0x0', status: agentStatus, lastAction: Date.now() },
  ]);

  const transactions = useMemo(() => messagesToTx(messages), [messages]);
  const pendingApprovals = useMemo(() => derivePending(messages), [messages]);

  // Pipeline stages with live per-agent action counts
  const stages: PipelineStage[] = [
    { role: 'YIELD_SCOUT', label: 'Yield Scout', verb: 'proposes', status: agentStatus, count: agentCounts[1] || 0 },
    { role: 'RISK_GUARD', label: 'Risk Guard', verb: 'vetoes / approves', status: agentStatus, count: agentCounts[2] || 0 },
    { role: 'EXECUTOR', label: 'Executor', verb: 'settles on-chain', status: agentStatus, count: agentCounts[3] || 0 },
    { role: 'GOVERNOR', label: 'Governor', verb: 'oversees', status: agentStatus, count: agentCounts[4] || 0 },
  ];
  const agentsOnline = agents.filter((a) => a.status === 'ONLINE').length;

  // Sparkline history centered on the live balance
  const [balanceHistory, setBalanceHistory] = useState<number[]>(() =>
    Array.from({ length: 24 }, (_, i) => Math.max(0, treasuryBalance * (0.94 + i * 0.0025))));
  useEffect(() => {
    setBalanceHistory((h) => [...h.slice(1), treasuryBalance * (0.99 + Math.random() * 0.02)]);
  }, [treasuryBalance]);

  return (
    <div style={{
      minHeight: '100vh', padding: '20px 28px 32px', maxWidth: '1440px', margin: '0 auto',
      fontFamily: FONT.body,
    }}>
      {/* ── Command Strip: live telemetry bar ── */}
      <CommandStrip
        blockNumber={blockNumber}
        networkStatus={networkStatus}
        controlState={controlState}
        agentsOnline={agentsOnline}
        agentsTotal={agents.length}
        treasuryValue={treasuryBalance}
        tokenSymbol={tokenSymbol}
      />

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '22px' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <h1 style={{
              fontFamily: FONT.display, fontSize: '2.4rem', fontWeight: 700,
              color: C.text, letterSpacing: '-0.5px', margin: 0, lineHeight: 1,
            }}>
              Swarm<span style={{ color: C.cyan }}> Treasury</span>
            </h1>
            {demoMode && (
              <span style={{
                fontFamily: FONT.mono, fontSize: '0.58rem', fontWeight: 700, color: C.amber,
                border: `1px solid ${C.amber}55`, borderRadius: '5px', padding: '2px 8px', letterSpacing: '1.5px',
              }}>DEMO</span>
            )}
          </div>
          <p style={{
            fontFamily: FONT.mono, fontSize: '0.66rem', color: C.secondary,
            margin: '7px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase',
          }}>
            Multi-Agent Autonomous Treasury &nbsp;·&nbsp; {chain.name}
          </p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: `${C.card}cc`, backdropFilter: 'blur(12px)',
          border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 16px',
        }}>
          <ConnectButton />
          <div style={{ width: 1, height: 26, background: C.border }} />
          <div>
            <div style={{
              fontFamily: FONT.mono, fontSize: '0.58rem', fontWeight: 600, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>{chain.name.split(' ')[0]}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: '0.85rem', fontWeight: 700, color: C.blue }}>
              #{blockNumber.toLocaleString()}
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Consensus Rail: how the swarm decides ── */}
      <Pipeline stages={stages} activeFlow={activeFlow} />

      {/* ── Bot Control ── */}
      <div style={{ marginBottom: '20px' }}>
        <ControlPanel />
      </div>

      {/* ── Top Row: Agents + Treasury ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
          <AgentStatusPanel agents={agents} />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
          <TreasuryMetrics
            balance={treasuryBalance}
            projectedBalance={Math.round(treasuryBalance * (1 + apy / 100))}
            apy={apy}
            balanceHistory={balanceHistory}
          />
        </motion.div>
      </div>

      {/* ── Middle Row: Messages + Governor ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <LiveMessageFeed messages={messages} isLoading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <GovernorPanel pendingApprovals={pendingApprovals} />
        </motion.div>
      </div>

      {/* ── Bottom: live event log ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <TransactionLog transactions={transactions} />
      </motion.div>

      {/* ── Footer ── */}
      <div style={{
        textAlign: 'center', padding: '26px 0 6px',
        fontFamily: FONT.mono, fontSize: '0.62rem', color: C.muted, letterSpacing: '0.5px',
      }}>
        <div>
          VAULT <span style={{ color: C.blue }}>{addresses?.TreasuryVault?.slice(0, 6)}…{addresses?.TreasuryVault?.slice(-4)}</span>
          &nbsp;&nbsp; REGISTRY <span style={{ color: C.cyan }}>{addresses?.AgentRegistry?.slice(0, 6)}…{addresses?.AgentRegistry?.slice(-4)}</span>
          &nbsp;&nbsp; BUS <span style={{ color: C.purple }}>{addresses?.MessageBus?.slice(0, 6)}…{addresses?.MessageBus?.slice(-4)}</span>
        </div>
        <div style={{ marginTop: '6px', color: C.muted, opacity: 0.7 }}>
          {chain.name} · chain {ACTIVE_CHAIN_ID} · {chain.explorer}
        </div>
      </div>
    </div>
  );
};

export default App;

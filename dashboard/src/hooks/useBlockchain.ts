import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CHAINS, ACTIVE_CHAIN_ID } from '../chainConfig';
import { RPC_URL, ADDRESSES, TOKEN_SYMBOL } from '../deployment';
import { ABIS } from '../abis.generated';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// ---------------------------------------------------------------------------
// Live blockchain hook — reads block, treasury balance (available + deployed),
// APY and proposal count. Falls back to demo values when no contract is
// deployed at the configured address (so the dashboard never breaks).
// ---------------------------------------------------------------------------
export const useBlockchain = () => {
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [blockTime, setBlockTime] = useState<number>(0.75);
  const [networkStatus, setNetworkStatus] = useState<string>('Connecting…');
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [deployedBalance, setDeployedBalance] = useState<number>(0);
  const [apy, setApy] = useState<number>(12);
  const [proposalCount, setProposalCount] = useState<number>(0);
  const [provider, setProvider] = useState<ethers.Provider | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rpcError, setRpcError] = useState<boolean>(false);
  // Real balance samples over time → honest sparkline + "recent change" delta.
  const [balanceSamples, setBalanceSamples] = useState<number[]>([]);

  const totalBalance = availableBalance + deployedBalance;

  useEffect(() => {
    const p = new ethers.JsonRpcProvider(RPC_URL);
    setProvider(p);
    let stopped = false;

    const tick = async () => {
      try {
        const bn = await p.getBlockNumber();
        if (stopped) return;
        setBlockNumber(bn);
        setRpcError(false);
        setNetworkStatus(demoMode ? networkStatus : `${CHAINS[ACTIVE_CHAIN_ID].name} · live`);
      } catch {
        if (!stopped) { setNetworkStatus('RPC unavailable'); setRpcError(true); }
      }
    };
    tick();
    const iv = setInterval(tick, 1000);

    (async () => {
      try {
        const code = await p.getCode(ADDRESSES.Governor);
        if (!code || code === '0x') {
          if (!stopped) {
            setDemoMode(true);
            setNetworkStatus('DEMO MODE · no contracts at configured addresses');
            // Demo figures so the hero still reads; clearly badged as DEMO.
            setAvailableBalance(64000);
            setDeployedBalance(36000);
            setApy(12);
            setProposalCount(0);
            setBalanceSamples(Array.from({ length: 24 }, (_, i) => 100000 * (0.965 + i * 0.0015)));
            setLoading(false);
          }
          return;
        }
        const vault = new ethers.Contract(ADDRESSES.TreasuryVault, ABIS.treasuryVault, p);
        const token = new ethers.Contract(ADDRESSES.MockToken, ERC20_ABI, p);
        const strat = new ethers.Contract(ADDRESSES.YieldStrategy, ABIS.yieldStrategy, p);
        const [idle, dec, apyB, pc, deployed] = await Promise.all([
          token.balanceOf(ADDRESSES.TreasuryVault),
          token.decimals(),
          strat.apyBps().catch(() => 0n),
          vault.proposalCount(),
          strat.getBalance().catch(() => 0n),
        ]);
        if (stopped) return;
        const idleN = Number(ethers.formatUnits(idle, dec));
        const deployedN = Number(ethers.formatUnits(deployed, dec));
        const apyN = Number(apyB) / 100;
        const pcN = Number(pc);
        // Treasury untouched (fresh deploy: nothing deposited, no strategies).
        // Show demo stats so the dashboard still looks alive; real data takes
        // over automatically once balance / strategies appear.
        if (idleN === 0 && deployedN === 0) {
          setAvailableBalance(64000);
          setDeployedBalance(36000);
          setApy(12);
          setProposalCount(0);
          setDemoMode(true);
          setBalanceSamples(Array.from({ length: 24 }, (_, i) => 100000 * (0.965 + i * 0.0015)));
        } else {
          setAvailableBalance(idleN);
          setDeployedBalance(deployedN);
          setApy(apyN);
          setProposalCount(pcN);
          setDemoMode(false);
          setBalanceSamples((s) => [...s.slice(-39), idleN + deployedN]);
        }
        setNetworkStatus(`${CHAINS[ACTIVE_CHAIN_ID].name} · live`);
        setLoading(false);
      } catch {
        if (!stopped) { setDemoMode(true); setLoading(false); setRpcError(true); }
      }
    })();

    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, []);

  return {
    blockNumber, blockTime, networkStatus, demoMode,
    availableBalance, deployedBalance, totalBalance,
    apy, proposalCount, tokenSymbol: TOKEN_SYMBOL,
    provider, addresses: ADDRESSES,
    loading, rpcError, balanceSamples,
  };
};

// Agent role colors for message styling
export const AGENT_COLORS: Record<string, string> = {
  '1': '#00d4ff', // Yield Scout - electric blue
  '2': '#00ff88', // Risk Guard - green
  '3': '#ffaa00', // Executor - amber
  '4': '#ff4444', // Governor - red
};

// Message types
export type MessageType = {
  messageId: number;
  proposalId: number;
  agentRole: number;
  messageType: number;
  blockNumber: number;
  dataHash: string;
  timestamp: number;
  agentName: string;
  actionType: string;
};

const ACTION_LABELS = ['PROPOSAL', 'APPROVAL', 'VETO', 'EXECUTED', 'PAUSE', 'RESUME'];

// Role hashes (keccak256 of the role name strings — match TreasuryVault.sol)
const ROLE_HASHES = {
  yieldScout: '0x' + ethers.keccak256(ethers.toUtf8Bytes('YIELD_SCOUT_ROLE')).slice(2),
  riskGuard:  '0x' + ethers.keccak256(ethers.toUtf8Bytes('RISK_GUARD_ROLE')).slice(2),
  executor:   '0x' + ethers.keccak256(ethers.toUtf8Bytes('EXECUTOR_ROLE')).slice(2),
  governor:   '0x' + ethers.keccak256(ethers.toUtf8Bytes('GOVERNOR_ROLE')).slice(2),
};

const MOCK_MESSAGES: MessageType[] = [
  { messageId: 1, proposalId: 1, agentRole: 1, messageType: 0, blockNumber: 12345, dataHash: '0xabc123…', timestamp: Date.now() - 60000, agentName: 'Yield Scout', actionType: 'PROPOSAL' },
  { messageId: 2, proposalId: 1, agentRole: 2, messageType: 1, blockNumber: 12346, dataHash: '0xdef456…', timestamp: Date.now() - 30000, agentName: 'Risk Guard', actionType: 'APPROVAL' },
  { messageId: 3, proposalId: 1, agentRole: 3, messageType: 3, blockNumber: 12347, dataHash: '0xghi789…', timestamp: Date.now() - 10000, agentName: 'Executor', actionType: 'EXECUTED' },
];

const LOOKBACK = 8000; // ~100 min at 0.75s blocks

/**
 * Identify which agent role a voter address holds on the vault by checking
 * hasRole for each role hash. Returns 1-4 or 0 if unknown.
 */
async function identifyRole(vault: ethers.Contract, addr: string): Promise<number> {
  try {
    if (await vault.hasRole(ROLE_HASHES.governor, addr))   return 4;
    if (await vault.hasRole(ROLE_HASHES.executor, addr))   return 3;
    if (await vault.hasRole(ROLE_HASHES.riskGuard, addr))  return 2;
    if (await vault.hasRole(ROLE_HASHES.yieldScout, addr)) return 1;
  } catch { /* role check failed */ }
  return 0;
}

// ---------------------------------------------------------------------------
// Agent message feed — reads TreasuryVault events directly (the MessageBus
// contract was never deployed, so we fall back to the on-chain event log).
// ---------------------------------------------------------------------------
export const useAgentMessages = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demo, setDemo] = useState<boolean>(false);

  useEffect(() => {
    const p = new ethers.JsonRpcProvider(RPC_URL);
    let stopped = false;

    const load = async () => {
      try {
        const code = await p.getCode(ADDRESSES.TreasuryVault);
        if (!code || code === '0x') throw new Error('no vault');

        const vault = new ethers.Contract(ADDRESSES.TreasuryVault, ABIS.treasuryVault, p);
        const latest = await p.getBlockNumber();
        const fromBlock = Math.max(0, latest - LOOKBACK);

        // Fire all event queries in parallel
        const [proposals, riskApprovals, scoutApprovals, votes, executed, cancelled] = await Promise.all([
          vault.queryFilter('ProposalCreated' as any, fromBlock, latest).catch(() => []),
          vault.queryFilter('RiskGuardApproved' as any, fromBlock, latest).catch(() => []),
          vault.queryFilter('YieldScoutApproved' as any, fromBlock, latest).catch(() => []),
          vault.queryFilter('VoteCast' as any, fromBlock, latest).catch(() => []),
          vault.queryFilter('ProposalExecuted' as any, fromBlock, latest).catch(() => []),
          vault.queryFilter('ProposalCancelled' as any, fromBlock, latest).catch(() => []),
        ]);

        // Build a cache of address → role to avoid redundant hasRole calls
        const roleCache = new Map<string, number>();
        const getRole = async (addr: string): Promise<number> => {
          const cached = roleCache.get(addr);
          if (cached !== undefined) return cached;
          const role = await identifyRole(vault, addr);
          roleCache.set(addr, role);
          return role;
        };

        const out: MessageType[] = [];
        let id = 0;

        for (const log of proposals as any[]) {
          const proposalId = Number(log.args?.proposalId ?? 0);
          const proposer = log.args?.proposer ?? '';
          const role = await getRole(proposer);
          const block = log.blockNumber;
          const ts = (await p.getBlock(block).catch(() => null))?.timestamp ?? 0;
          out.push({
            messageId: id++, proposalId, agentRole: role || 1, messageType: 0,
            blockNumber: block, dataHash: `${proposalId} → ${(log.args?.target ?? '').slice(0, 10)}…`,
            timestamp: ts ? ts * 1000 : Date.now(),
            agentName: role === 1 ? 'Yield Scout' : 'Agent',
            actionType: 'PROPOSAL',
          });
        }

        for (const log of riskApprovals as any[]) {
          const proposalId = Number(log.args?.proposalId ?? 0);
          const block = log.blockNumber;
          const ts = (await p.getBlock(block).catch(() => null))?.timestamp ?? 0;
          out.push({
            messageId: id++, proposalId, agentRole: 2, messageType: 1,
            blockNumber: block, dataHash: `#${proposalId} approved`,
            timestamp: ts ? ts * 1000 : Date.now(),
            agentName: 'Risk Guard', actionType: 'APPROVAL',
          });
        }

        for (const log of scoutApprovals as any[]) {
          const proposalId = Number(log.args?.proposalId ?? 0);
          const block = log.blockNumber;
          const ts = (await p.getBlock(block).catch(() => null))?.timestamp ?? 0;
          out.push({
            messageId: id++, proposalId, agentRole: 1, messageType: 1,
            blockNumber: block, dataHash: `#${proposalId} approved`,
            timestamp: ts ? ts * 1000 : Date.now(),
            agentName: 'Yield Scout', actionType: 'APPROVAL',
          });
        }

        for (const log of votes as any[]) {
          const proposalId = Number(log.args?.proposalId ?? 0);
          const voter = log.args?.voter ?? '';
          const support = log.args?.support;
          const role = await getRole(voter);
          const block = log.blockNumber;
          const ts = (await p.getBlock(block).catch(() => null))?.timestamp ?? 0;
          const actionType = support ? 'APPROVAL' : 'VETO';
          const msgType = support ? 1 : 2;
          const roleNames: Record<number, string> = { 1: 'Yield Scout', 2: 'Risk Guard', 3: 'Executor', 4: 'Governor' };
          out.push({
            messageId: id++, proposalId, agentRole: role || 4, messageType: msgType,
            blockNumber: block, dataHash: `#${proposalId} ${support ? 'voted YES' : 'voted NO'}`,
            timestamp: ts ? ts * 1000 : Date.now(),
            agentName: roleNames[role] || 'Agent',
            actionType,
          });
        }

        for (const log of executed as any[]) {
          const proposalId = Number(log.args?.proposalId ?? 0);
          const block = log.blockNumber;
          const ts = (await p.getBlock(block).catch(() => null))?.timestamp ?? 0;
          out.push({
            messageId: id++, proposalId, agentRole: 3, messageType: 3,
            blockNumber: block, dataHash: `#${proposalId} executed ✓`,
            timestamp: ts ? ts * 1000 : Date.now(),
            agentName: 'Executor', actionType: 'EXECUTED',
          });
        }

        for (const log of cancelled as any[]) {
          const proposalId = Number(log.args?.proposalId ?? 0);
          const block = log.blockNumber;
          const ts = (await p.getBlock(block).catch(() => null))?.timestamp ?? 0;
          out.push({
            messageId: id++, proposalId, agentRole: 2, messageType: 2,
            blockNumber: block, dataHash: `#${proposalId} vetoed ✗`,
            timestamp: ts ? ts * 1000 : Date.now(),
            agentName: 'Risk Guard', actionType: 'VETO',
          });
        }

        if (stopped) return;

        if (out.length === 0) {
          // No on-chain activity yet — show demo feed so the panel isn't blank
          setDemo(true);
          setMessages(MOCK_MESSAGES);
        } else {
          out.sort((a, b) => b.blockNumber - a.blockNumber);
          setMessages(out.slice(0, 30));
          setDemo(false);
        }
        setIsLoading(false);
      } catch {
        if (stopped) return;
        setDemo(true);
        setMessages(MOCK_MESSAGES);
        setIsLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 5000);
    return () => { stopped = true; clearInterval(iv); };
  }, []);

  // Per-agent action counts (role 1..4) derived from the live feed
  const agentCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const m of messages) {
    const r = Number(m.agentRole);
    if (r >= 1 && r <= 4) agentCounts[r] += 1;
  }

  // A proposal is "flowing" if any message landed in the last 30s
  const activeFlow = messages.some((m) => Date.now() - m.timestamp < 30_000);

  return { messages, isLoading, demo, agentCounts, activeFlow };
};

export default useBlockchain;

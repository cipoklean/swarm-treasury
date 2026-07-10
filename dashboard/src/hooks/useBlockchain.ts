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
// Live blockchain hook — reads block, treasury balance, APY, proposal count.
// Falls back to demo values when no contract is deployed at the configured
// address (so the dashboard never breaks and the filmed UI still looks alive).
// ---------------------------------------------------------------------------
export const useBlockchain = () => {
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [blockTime, setBlockTime] = useState<number>(0.75);
  const [networkStatus, setNetworkStatus] = useState<string>('Connecting…');
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [treasuryBalance, setTreasuryBalance] = useState<number>(100000);
  const [apy, setApy] = useState<number>(12);
  const [proposalCount, setProposalCount] = useState<number>(0);
  const [provider, setProvider] = useState<ethers.Provider | null>(null);

  useEffect(() => {
    const p = new ethers.JsonRpcProvider(RPC_URL);
    setProvider(p);
    let stopped = false;

    const tick = async () => {
      try {
        const bn = await p.getBlockNumber();
        if (stopped) return;
        setBlockNumber(bn);
        setNetworkStatus(demoMode ? networkStatus : `${CHAINS[ACTIVE_CHAIN_ID].name} · live`);
      } catch {
        if (!stopped) setNetworkStatus('RPC unavailable');
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
          }
          return;
        }
        const vault = new ethers.Contract(ADDRESSES.TreasuryVault, ABIS.treasuryVault, p);
        const token = new ethers.Contract(ADDRESSES.MockToken, ERC20_ABI, p);
        const strat = new ethers.Contract(ADDRESSES.YieldStrategy, ABIS.yieldStrategy, p);
        const [bal, dec, apyB, pc] = await Promise.all([
          token.balanceOf(ADDRESSES.TreasuryVault),
          token.decimals(),
          strat.apyBps(),
          vault.proposalCount(),
        ]);
        if (stopped) return;
        setTreasuryBalance(Number(ethers.formatUnits(bal, dec)));
        setApy(Number(apyB) / 100);
        setProposalCount(Number(pc));
        setDemoMode(false);
        setNetworkStatus(`${CHAINS[ACTIVE_CHAIN_ID].name} · live`);
      } catch {
        if (!stopped) setDemoMode(true);
      }
    })();

    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, []);

  return {
    blockNumber, blockTime, networkStatus, demoMode,
    treasuryBalance, apy, proposalCount, tokenSymbol: TOKEN_SYMBOL,
    provider, addresses: ADDRESSES,
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

function mapMessage(m: any, id: number): MessageType {
  const msgType = Number(m.msgType ?? m[1] ?? 0);
  const block = Number(m.blockNumber ?? m[5] ?? 0);
  const ts = Number(m.timestamp ?? m[4] ?? 0);
  const data = m.data ?? m[3] ?? '0x';
  const dataHash =
    typeof data === 'string' ? data.slice(0, 10) : ethers.hexlify(data as any).slice(0, 10);
  return {
    messageId: Number(m.id ?? m[0] ?? id),
    proposalId: Number(m.proposalId ?? 0),
    agentRole: msgType,
    messageType: msgType,
    blockNumber: block,
    dataHash: dataHash + '…',
    timestamp: ts ? ts * 1000 : Date.now(),
    agentName: ['Yield Scout', 'Risk Guard', 'Executor', 'Governor'][Math.min(msgType, 3)] || 'Agent',
    actionType: ACTION_LABELS[msgType] || 'MESSAGE',
  };
}

const MOCK_MESSAGES: MessageType[] = [
  { messageId: 1, proposalId: 1, agentRole: 1, messageType: 0, blockNumber: 12345, dataHash: '0xabc123…', timestamp: Date.now() - 60000, agentName: 'Yield Scout', actionType: 'PROPOSAL' },
  { messageId: 2, proposalId: 1, agentRole: 2, messageType: 1, blockNumber: 12346, dataHash: '0xdef456…', timestamp: Date.now() - 30000, agentName: 'Risk Guard', actionType: 'APPROVAL' },
  { messageId: 3, proposalId: 1, agentRole: 3, messageType: 3, blockNumber: 12347, dataHash: '0xghi789…', timestamp: Date.now() - 10000, agentName: 'Executor', actionType: 'EXECUTED' },
];

// ---------------------------------------------------------------------------
// Agent message feed — reads the MessageBus when deployed, else demo feed.
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
        const code = await p.getCode(ADDRESSES.MessageBus);
        if (!code || code === '0x') throw new Error('no bus');
        const bus = new ethers.Contract(ADDRESSES.MessageBus, ABIS.messageBus, p);
        const count = Number(await bus.getMessageCount());
        const start = Math.max(0, count - 20);
        const out: MessageType[] = [];
        for (let i = start; i < count; i++) {
          const m = await bus.getMessage(i);
          out.push(mapMessage(m, i));
        }
        if (stopped) return;
        setMessages(out.reverse());
        setDemo(false);
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
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, []);

  return { messages, isLoading, demo };
};

export default useBlockchain;

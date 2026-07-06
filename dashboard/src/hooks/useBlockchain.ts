import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ACTIVE_CHAIN_ID, CHAINS, DEPLOYED_ADDRESSES } from '../chainConfig';

export const useBlockchain = () => {
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [blockTime, setBlockTime] = useState<number>(0);
  const [networkStatus, setNetworkStatus] = useState<string>('Connecting...');
  const [provider, setProvider] = useState<ethers.Provider | null>(null);

  useEffect(() => {
    const chain = CHAINS[ACTIVE_CHAIN_ID] || CHAINS[31337];
    const addresses = DEPLOYED_ADDRESSES[ACTIVE_CHAIN_ID as keyof typeof DEPLOYED_ADDRESSES];

    const connect = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        setProvider(provider);

        const block = await provider.getBlock('latest');
        if (block) {
          setBlockNumber(block.number);
          setNetworkStatus(`${chain.name} · Vault ${addresses?.TreasuryVault?.slice(0,6)}...`);
        }

        provider.on('block', (bn) => {
          setBlockNumber(bn);
          setNetworkStatus('Connected');
        });

        setBlockTime(0.75);
      } catch (error) {
        console.error('Failed to connect:', error);
        setNetworkStatus('Connection Failed');
      }
    };

    connect();
    return () => { provider?.removeAllListeners(); };
  }, []);

  return { blockNumber, blockTime, networkStatus, provider };
};

// Agent role colors for message styling
export const AGENT_COLORS: Record<string, string> = {
  '1': '#00d4ff', // Yield Scout - electric blue
  '2': '#00ff88', // Risk Guard - green
  '3': '#ffaa00', // Executor - amber
  '4': '#ff4444'  // Governor - red
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

export const useAgentMessages = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // In a real implementation, this would connect to the MessageBus contract
    // and listen for new messages via WebSocket or polling
    
    // Mock data for demo
    const mockMessages: MessageType[] = [
      {
        messageId: 1,
        proposalId: 1,
        agentRole: 1, // Yield Scout
        messageType: 0, // Proposal
        blockNumber: 12345,
        dataHash: '0xabc123...',
        timestamp: Date.now() - 60000,
        agentName: 'Yield Scout',
        actionType: 'PROPOSAL'
      },
      {
        messageId: 2,
        proposalId: 1,
        agentRole: 2, // Risk Guard
        messageType: 1, // Approval
        blockNumber: 12346,
        dataHash: '0xdef456...',
        timestamp: Date.now() - 30000,
        agentName: 'Risk Guard',
        actionType: 'APPROVAL'
      },
      {
        messageId: 3,
        proposalId: 1,
        agentRole: 3, // Executor
        messageType: 1, // Executed
        blockNumber: 12347,
        dataHash: '0xghi789...',
        timestamp: Date.now() - 10000,
        agentName: 'Executor',
        actionType: 'EXECUTED'
      }
    ];
    
    // Simulate new messages coming in
    const interval = setInterval(() => {
      const newMessage: MessageType = {
        messageId: messages.length + 1,
        proposalId: Math.floor(Math.random() * 10) + 1,
        agentRole: Math.floor(Math.random() * 4) + 1,
        messageType: Math.floor(Math.random() * 3),
        blockNumber: Math.floor(Math.random() * 5) + 12350,
        dataHash: `0x${Math.random().toString(16).substring(2, 10)}...`,
        timestamp: Date.now(),
        agentName: ['Yield Scout', 'Risk Guard', 'Executor', 'Governor'][Math.floor(Math.random() * 4)],
        actionType: ['PROPOSAL', 'APPROVAL', 'VETO', 'EXECUTED'][Math.floor(Math.random() * 4)]
      };
      
      setMessages(prev => [newMessage, ...prev].slice(0, 50));
    }, 10000);
    
    // Initial load
    setTimeout(() => {
      setMessages(mockMessages);
      setIsLoading(false);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { messages, isLoading };
};

export default useBlockchain;

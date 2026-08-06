// ---------------------------------------------------------------------------
// Chain configuration — testnet (rialto) is live; mainnet is a placeholder
// until BOT Chain publishes mainnet parameters.
// Switch networks via VITE_CHAIN_ID env var (defaults to 968 testnet).
// ---------------------------------------------------------------------------

export const DEPLOYED_ADDRESSES: Record<number, Record<string, string>> = {
  // BOT Chain Testnet (rialto)
  968: {
    TreasuryVault:  '0x459E75ba6E7d5DC77d2ECBbA5aF41D48619B1AdD',
    AgentRegistry:  '0xbC7FE5639b177EE428e87c3650D1ecaA91DE47C8',
    MessageBus:     '0x38D7F3C9A9DA917F253c3ca64DD922eC5c7ed4c0',
    Governor:       '0xC9163e9403078220Bf060BB4b3959C9d28a12E75',
    MockToken:      '0x3A7A55B6Ba049c1B742f7491254EC980452897Be',
    MockStrategy:   '0x6bA34B034690Bd22f4DB95F023D98fd5f5483C40',
  },
  // TODO: BOT Chain Mainnet — update chain ID, RPC, and addresses after mainnet launch
  // 1: {
  //   TreasuryVault:  '0x...',
  //   AgentRegistry:  '0x...',
  //   MessageBus:     '0x...',
  //   Governor:       '0x...',
  //   MockToken:      '0x...',  // replace with real BOT/ERC-20 token
  //   MockStrategy:   '0x...',  // replace with real yield strategy
  // },
};

export const CHAINS: Record<number, { rpc: string; name: string; explorer: string }> = {
  968: {
    rpc: 'https://rpc.bohr.life',
    name: 'BOT Chain Testnet',
    explorer: 'https://scan.botchain.ai',
  },
  // TODO: BOT Chain Mainnet
  // 1: {
  //   rpc: 'https://rpc.botchain.ai',
  //   name: 'BOT Chain Mainnet',
  //   explorer: 'https://scan.botchain.ai',
  // },
};

const envChainId = Number((import.meta as any).env?.VITE_CHAIN_ID) || 968;
export const ACTIVE_CHAIN_ID = envChainId;

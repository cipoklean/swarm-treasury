// ---------------------------------------------------------------------------
// Chain configuration — testnet (rialto) is live; mainnet is a placeholder
// until BOT Chain publishes mainnet parameters.
// Switch networks via VITE_CHAIN_ID env var (defaults to 968 testnet).
// ---------------------------------------------------------------------------

export const DEPLOYED_ADDRESSES: Record<number, Record<string, string>> = {
  // BOT Chain Testnet (rialto)
  968: {
    TreasuryVault:  '0xDE3b01A9f936170e09089CB15A187CaE3442559c',
    AgentRegistry:  '0x9b29Fe91ABE65846F0EeFf3989b9C8a496E2260B',
    MessageBus:     '0xA9e5FF4F6284c22dD98bac50bEd86A2E3ED5d43D',
    Governor:       '0x088e7FA7271858f5Fb3E029818AC3e5A174aEEcd',
    MockToken:      '0xC4A78F258fe5E97DD97C548BEAe237f202C4A37c',
    MockStrategy:   '0xCc68Ae95D2Bb23Ffed211e39287228939dA6e8e8',
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

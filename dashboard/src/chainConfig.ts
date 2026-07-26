// ---------------------------------------------------------------------------
// Chain configuration — testnet (rialto) is live; mainnet is a placeholder
// until BOT Chain publishes mainnet parameters.
// Switch networks via VITE_CHAIN_ID env var (defaults to 968 testnet).
// ---------------------------------------------------------------------------

export const DEPLOYED_ADDRESSES: Record<number, Record<string, string>> = {
  // BOT Chain Testnet (rialto)
  968: {
    TreasuryVault:  '0x3a7282ffb230742ed31cfeda0ed6cde5a34d1dee',
    AgentRegistry:  '0xcf8336e6b484365841c3fe745a5d12b9068497bd',
    MessageBus:     '0xd00d17a8ad8db5e8aa7b9dd2acf76e93c5a029e8',
    Governor:       '0x10e7d33d7a957c09786d587f273acafd13014fe6',
    MockToken:      '0xae7722bc560dc4d625cbf30f154faf3e3fa13852',
    MockStrategy:   '0x62067aa0d072397eb2c18bcaa273b7b4bd88c7dd',
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

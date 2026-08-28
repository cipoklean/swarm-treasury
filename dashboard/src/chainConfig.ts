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
  // BOT Chain Mainnet (677) — deployed 2026-08-27
  677: {
    TreasuryVault:  '0x3Ad5eE79fe0dFf0D38645eA5Fc1D2EDd6B490A64',
    AgentRegistry:  '0x38280Bc47E893051dA76ec6e74B04056AA7b7322',
    MessageBus:     '0x5BAcD085e34410eb3AFDfD2a95eDf8F16Ed8860e',
    Governor:       '0x5463b572AbF7f20D9934979FC2bfB0Ee0Bd29361',
    MockToken:      '0x2765F822156A0CfB1F69eaCf3b76aA261184fFC3',
    MockStrategy:   '0xf1846688a8191127eb4Fc6c70611a40784a9249e',
  },
};

export const CHAINS: Record<number, { rpc: string; name: string; explorer: string }> = {
  968: {
    rpc: 'https://rpc.bohr.life',
    name: 'BOT Chain Testnet',
    explorer: 'https://scan.botchain.ai',
  },
  677: {
    rpc: 'https://rpc.botchain.ai',
    name: 'BOT Chain Mainnet',
    explorer: 'https://scan.botchain.ai',
  },
};

const envChainId = Number((import.meta as any).env?.VITE_CHAIN_ID) || 968;
export const ACTIVE_CHAIN_ID = envChainId;

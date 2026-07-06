export const DEPLOYED_ADDRESSES = {
  968: {
    TreasuryVault:  '0xDE3b01A9f936170e09089CB15A187CaE3442559c',
    AgentRegistry:  '0x9b29Fe91ABE65846F0EeFf3989b9C8a496E2260B',
    MessageBus:     '0xA9e5FF4F6284c22dD98bac50bEd86A2E3ED5d43D',
    Governor:       '0x088e7FA7271858f5Fb3E029818AC3e5A174aEEcd',
    MockToken:      '0xC4A78F258fe5E97DD97C548BEAe237f202C4A37c',
    MockStrategy:   '0xCc68Ae95D2Bb23Ffed211e39287228939dA6e8e8',
  },
};
export const CHAINS: Record<number, { rpc: string; name: string }> = {
  968:  { rpc: 'https://rpc.bohr.life', name: 'BOT Chain Testnet' },
};
export const ACTIVE_CHAIN_ID = 968;

import { DEPLOYED_ADDRESSES, ACTIVE_CHAIN_ID, CHAINS } from './chainConfig';

// env overrides let you point the dashboard at REAL deployments without code edits
// (set these in Render / a .env file). Falls back to the placeholders in chainConfig.
const env: any = (import.meta as any).env;
const ov = (e: string | undefined, d?: string): string => (e && e.length ? e : d ?? '');

const d = DEPLOYED_ADDRESSES[ACTIVE_CHAIN_ID as keyof typeof DEPLOYED_ADDRESSES];

export const CHAIN_ID = ACTIVE_CHAIN_ID;
export const RPC_URL: string = env.VITE_RPC_URL || CHAINS[ACTIVE_CHAIN_ID].rpc;
export const TOKEN_SYMBOL: string = env.VITE_TOKEN_SYMBOL || 'sUSD';

export const ADDRESSES = {
  TreasuryVault: ov(env.VITE_TREASURY_VAULT, d?.TreasuryVault),
  AgentRegistry: ov(env.VITE_AGENT_REGISTRY, d?.AgentRegistry),
  MessageBus: ov(env.VITE_MESSAGE_BUS, d?.MessageBus),
  Governor: ov(env.VITE_GOVERNOR, d?.Governor),
  MockToken: ov(env.VITE_TOKEN, d?.MockToken),
  YieldStrategy: ov(env.VITE_STRATEGY, d?.MockStrategy),
};

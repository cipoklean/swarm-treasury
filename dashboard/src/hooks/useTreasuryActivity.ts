import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { RPC_URL, ADDRESSES } from '../deployment';
import { ABIS } from '../abis.generated';

// ---------------------------------------------------------------------------
// Treasury activity feed — reads REAL on-chain events from the TreasuryVault
// (proposals, deposits, withdrawals, strategy moves) so every row carries a
// genuine amount, counterparty, gas and status. No mock fallback: when the
// chain is quiet we surface an honest empty state instead (feedback #3 & #4).
// ---------------------------------------------------------------------------

export type ActivityCategory = 'in' | 'out' | 'neutral';

export interface Activity {
  key: string;
  type: string;
  category: ActivityCategory;
  amount: number | null;      // token units, null when the event carries none
  counterparty: string | null; // target / to / from / strategy address
  block: number;
  timestamp: number;          // ms epoch
  txHash: string;
  gas: number | null;         // gasUsed from the receipt
  status: 'CONFIRMED';
}

const ERC20_ABI = ['function decimals() view returns (uint8)'];

// How far back to scan for events (BotChain ~0.75s blocks → 4000 ≈ 50 min).
const LOOKBACK_BLOCKS = 4000;
const MAX_ROWS = 20;

interface EventSpec {
  event: string;
  type: string;
  category: ActivityCategory;
  amountField?: string;
  partyField?: string;
}

const SPECS: EventSpec[] = [
  { event: 'ProposalCreated',   type: 'Proposal Created',   category: 'neutral', amountField: 'value',  partyField: 'target' },
  { event: 'ProposalExecuted',  type: 'Proposal Executed',  category: 'neutral' },
  { event: 'TreasuryDeposit',   type: 'Treasury Deposit',   category: 'in',      amountField: 'amount', partyField: 'from' },
  { event: 'TreasuryWithdrawal',type: 'Treasury Withdrawal',category: 'out',     amountField: 'amount', partyField: 'to' },
  { event: 'StrategyDeposited', type: 'Deployed to Strategy',category: 'out',    amountField: 'amount', partyField: 'strategy' },
  { event: 'StrategyWithdrawn', type: 'Strategy Withdrawal',category: 'in',      amountField: 'amount', partyField: 'strategy' },
  { event: 'StrategyHarvested', type: 'Yield Harvested',    category: 'in',      amountField: 'amount', partyField: 'strategy' },
  { event: 'EmergencyWithdrawal',type:'Emergency Withdrawal',category:'out',     amountField: 'amount', partyField: 'to' },
  { event: 'EmergencyPause',    type: 'Emergency Pause',    category: 'neutral', partyField: 'guardian' },
];

export const useTreasuryActivity = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new ethers.JsonRpcProvider(RPC_URL);
    let stopped = false;

    const load = async () => {
      try {
        const code = await p.getCode(ADDRESSES.TreasuryVault);
        if (!code || code === '0x') {
          // Nothing deployed → honest empty state, not an error.
          if (!stopped) { setActivities([]); setLoading(false); setError(null); }
          return;
        }
        const vault = new ethers.Contract(ADDRESSES.TreasuryVault, ABIS.treasuryVault, p);
        let decimals = 18;
        try {
          const token = new ethers.Contract(ADDRESSES.MockToken, ERC20_ABI, p);
          decimals = Number(await token.decimals());
        } catch { /* fall back to 18 */ }

        const latest = await p.getBlockNumber();
        const fromBlock = Math.max(0, latest - LOOKBACK_BLOCKS);

        // Query every spec in parallel; skip events the ABI doesn't expose.
        const results = await Promise.all(
          SPECS.map(async (spec) => {
            try {
              const logs = await vault.queryFilter(spec.event as any, fromBlock, latest);
              return { spec, logs };
            } catch {
              return { spec, logs: [] as any[] };
            }
          }),
        );

        const rows: Activity[] = [];
        for (const { spec, logs } of results) {
          for (const log of logs as any[]) {
            const args = log.args ?? {};
            const rawAmount = spec.amountField ? args[spec.amountField] : undefined;
            const party = spec.partyField ? (args[spec.partyField] as string | undefined) : undefined;
            const block = await p.getBlock(log.blockNumber).catch(() => null);
            rows.push({
              key: `${log.transactionHash}-${log.index}`,
              type: spec.type,
              category: spec.category,
              amount: rawAmount !== undefined ? Number(ethers.formatUnits(rawAmount, decimals)) : null,
              counterparty: party ?? null,
              block: log.blockNumber,
              timestamp: block ? block.timestamp * 1000 : Date.now(),
              txHash: log.transactionHash,
              gas: null,
              status: 'CONFIRMED',
            });
          }
        }

        // Newest first, capped.
        rows.sort((a, b) => b.block - a.block || b.timestamp - a.timestamp);
        const capped = rows.slice(0, MAX_ROWS);

        // Enrich with gas from receipts (one lookup per unique tx, in parallel).
        const uniqueHashes = [...new Set(capped.map((r) => r.txHash))];
        const gasByHash = new Map<string, number | null>();
        await Promise.all(
          uniqueHashes.map(async (h) => {
            try {
              const rc = await p.getTransactionReceipt(h);
              gasByHash.set(h, rc ? Number(rc.gasUsed) : null);
            } catch {
              gasByHash.set(h, null);
            }
          }),
        );
        for (const r of capped) r.gas = gasByHash.get(r.txHash) ?? null;

        if (!stopped) { setActivities(capped); setLoading(false); setError(null); }
      } catch (e: any) {
        if (!stopped) { setError(e?.message || 'Failed to load activity'); setLoading(false); }
      }
    };

    load();
    const iv = setInterval(load, 7000);
    return () => { stopped = true; clearInterval(iv); };
  }, []);

  return { activities, loading, error };
};

export default useTreasuryActivity;

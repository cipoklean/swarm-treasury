#!/usr/bin/env python3
"""
Executor Agent — executes approved proposals on-chain
Part of Swarm Treasury multi-agent system

NOTE: The deployed TreasuryVault's proposals() getter returns 9 fields:
  [0] proposer, [1] target, [2] value, [3] data, [4] deadline,
  [5] forVotes, [6] againstVotes, [7] executed, [8] cancelled

  Approval fields (yieldScoutApproved, riskGuardApproved, approvedAtBlock)
  are NOT in the getter return data. We track approvals via events instead.
"""

import asyncio
import json
import logging
import os
import signal
import time
from typing import Dict, Any, List, Optional, Set

from botchain_client import BotChainClient, get_botchain_client
from control_state import ControlState

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","message":"%(message)s","module":"botchain_client"}'
)
logger = logging.getLogger(__name__)


# Minimal ABI — matches what the deployed contract actually returns
MINIMAL_PROPOSAL_ABI = [
    {
        'name': 'proposals',
        'type': 'function',
        'stateMutability': 'view',
        'inputs': [{'name': 'id', 'type': 'uint256'}],
        'outputs': [
            {'name': 'proposer', 'type': 'address'},
            {'name': 'target', 'type': 'address'},
            {'name': 'value', 'type': 'uint256'},
            {'name': 'data', 'type': 'bytes'},
            {'name': 'deadline', 'type': 'uint256'},
            {'name': 'forVotes', 'type': 'uint256'},
            {'name': 'againstVotes', 'type': 'uint256'},
            {'name': 'executed', 'type': 'bool'},
            {'name': 'cancelled', 'type': 'bool'},
        ]
    },
    {
        'name': 'proposalCount',
        'type': 'function',
        'stateMutability': 'view',
        'inputs': [],
        'outputs': [{'name': '', 'type': 'uint256'}]
    },
    {
        'name': 'quorum',
        'type': 'function',
        'stateMutability': 'view',
        'inputs': [],
        'outputs': [{'name': '', 'type': 'uint256'}]
    },
    {
        'name': 'executeProposal',
        'type': 'function',
        'stateMutability': 'nonpayable',
        'inputs': [{'name': 'proposalId', 'type': 'uint256'}],
        'outputs': []
    },
    {
        'name': 'vote',
        'type': 'function',
        'stateMutability': 'nonpayable',
        'inputs': [
            {'name': 'proposalId', 'type': 'uint256'},
            {'name': 'support', 'type': 'bool'}
        ],
        'outputs': []
    },
    # Events for tracking approvals
    {
        'name': 'ProposalCreated',
        'type': 'event',
        'inputs': [
            {'name': 'proposalId', 'type': 'uint256', 'indexed': True},
            {'name': 'proposer', 'type': 'address', 'indexed': True},
            {'name': 'target', 'type': 'address', 'indexed': False},
            {'name': 'value', 'type': 'uint256', 'indexed': False},
            {'name': 'data', 'type': 'bytes', 'indexed': False},
            {'name': 'deadline', 'type': 'uint256', 'indexed': False},
        ]
    },
    {
        'name': 'RiskGuardApproved',
        'type': 'event',
        'inputs': [
            {'name': 'proposalId', 'type': 'uint256', 'indexed': True},
            {'name': 'agent', 'type': 'address', 'indexed': True},
        ]
    },
    {
        'name': 'YieldScoutApproved',
        'type': 'event',
        'inputs': [
            {'name': 'proposalId', 'type': 'uint256', 'indexed': True},
            {'name': 'agent', 'type': 'address', 'indexed': True},
        ]
    },
    {
        'name': 'VoteCast',
        'type': 'event',
        'inputs': [
            {'name': 'proposalId', 'type': 'uint256', 'indexed': True},
            {'name': 'voter', 'type': 'address', 'indexed': True},
            {'name': 'support', 'type': 'bool', 'indexed': False},
        ]
    },
    {
        'name': 'ProposalExecuted',
        'type': 'event',
        'inputs': [
            {'name': 'proposalId', 'type': 'uint256', 'indexed': True},
        ]
    },
]


class Executor:
    def __init__(self, private_key: str, agent_address: str):
        self.private_key = private_key
        self.agent_address = agent_address
        self.client: BotChainClient = get_botchain_client()
        self.treasury_vault = None
        self.message_bus = None
        self.agent_registry = None
        self.completed_proposals: Set[int] = set()  # permanently done
        self.retry_count: Dict[int, int] = {}
        self.max_retries = 3
        # Event-based tracking
        self.rg_approved: Set[int] = set()  # Risk Guard approved proposals
        self.ys_approved: Set[int] = set()  # Yield Scout approved proposals (auto at creation)
        self.voted_proposals: Set[int] = set()  # Proposals we voted on
        self.last_event_block: int = 0  # scan progress

    async def initialize_contracts(self, config: Dict[str, Any]) -> None:
        # Use full ABI for message_bus and agent_registry
        self.message_bus = self.client.load_contract('MessageBus', config['message_bus_address'], config['message_bus_abi'])
        self.agent_registry = self.client.load_contract('AgentRegistry', config['agent_registry_address'], config['agent_registry_abi'])

        # Use MINIMAL ABI for treasury_vault (matches deployed contract)
        self.treasury_vault = self.client.load_contract(
            'TreasuryVault',
            config['treasury_vault_address'],
            MINIMAL_PROPOSAL_ABI
        )
        logger.info("Contracts initialized (using minimal proposals ABI)")

    def _get_raw_logs(self, topic0: str, from_block: int, to_block: int) -> list:
        """Get raw event logs using eth_getLogs RPC directly.
        Bypasses web3.py event API which doesn't work with this testnet node."""
        filter_obj = {
            'fromBlock': hex(from_block),
            'toBlock': hex(to_block),
            'address': self.treasury_vault.address,
            'topics': [topic0],
        }
        return self.client.w3.eth.get_logs(filter_obj)

    @staticmethod
    def _event_topic(signature: str) -> str:
        """Compute keccak256 event topic hash."""
        from web3 import Web
        return Web.keccak(text=signature).hex()

    async def scan_approval_events(self) -> None:
        """Scan blockchain events to track approval status for all proposals.
        Uses raw eth_getLogs RPC (not web3.py event API) because
        the testnet node doesn't support the event filtering methods."""
        try:
            current_block = await asyncio.to_thread(
                lambda: self.client.w3.eth.block_number
            )
            if self.last_event_block == 0:
                # On first run, scan from much further back to catch all historical events
                self.last_event_block = max(1, current_block - 50000)

            from_block = self.last_event_block + 1
            to_block = current_block

            if from_block > to_block:
                return

            # Pre-compute event topic hashes
            rg_topic = self._event_topic('RiskGuardApproved(uint256,address)')
            ys_topic = self._event_topic('YieldScoutApproved(uint256,address)')
            pc_topic = self._event_topic('ProposalCreated(uint256,address,address,uint256,bytes,uint256)')

            rg_count = 0
            ys_count = 0
            pc_count = 0

            # Scan RiskGuardApproved events via raw eth_getLogs
            try:
                rg_logs = await asyncio.to_thread(
                    self._get_raw_logs, rg_topic, from_block, to_block
                )
                for log in rg_logs:
                    # proposalId is indexed topic[1] — decode from hex
                    if log.get('topics') and len(log['topics']) >= 2:
                        pid = int(log['topics'][1].hex(), 16)
                        self.rg_approved.add(pid)
                        rg_count += 1
                if rg_count > 0:
                    logger.info(f"Scanned {rg_count} RiskGuardApproved events (blocks {from_block}-{to_block})")
            except Exception as e:
                logger.warning(f"RiskGuardApproved scan error: {e}")

            # YieldScoutApproved events
            try:
                ys_logs = await asyncio.to_thread(
                    self._get_raw_logs, ys_topic, from_block, to_block
                )
                for log in ys_logs:
                    if log.get('topics') and len(log['topics']) >= 2:
                        pid = int(log['topics'][1].hex(), 16)
                        self.ys_approved.add(pid)
                        ys_count += 1
                if ys_count > 0:
                    logger.info(f"Scanned {ys_count} YieldScoutApproved events")
            except Exception as e:
                logger.warning(f"YieldScoutApproved scan error: {e}")

            # ProposalCreated events (createProposal auto-sets yieldScoutApproved=true)
            try:
                pc_logs = await asyncio.to_thread(
                    self._get_raw_logs, pc_topic, from_block, to_block
                )
                for log in pc_logs:
                    if log.get('topics') and len(log['topics']) >= 2:
                        pid = int(log['topics'][1].hex(), 16)
                        self.ys_approved.add(pid)
                        pc_count += 1
                if pc_count > 0:
                    logger.info(f"Scanned {pc_count} ProposalCreated events")
            except Exception as e:
                logger.warning(f"ProposalCreated scan error: {e}")

            self.last_event_block = to_block
            if rg_count + ys_count + pc_count > 0:
                logger.info(f"Approval sets: {len(self.rg_approved)} RG-approved, {len(self.ys_approved)} YS-approved")

        except Exception as e:
            logger.error(f"Error scanning approval events: {e}")

    async def get_ready_proposals(self) -> List[Dict]:
        """Find proposals that are ready for execution.
        Checks proposals that have both RG and YS approval via event tracking,
        then verifies on-chain status via the 9-field proposals() getter."""
        ready = []
        try:
            proposal_count = await asyncio.to_thread(
                lambda: self.treasury_vault.functions.proposalCount().call()
            )
            current_block = await asyncio.to_thread(
                lambda: self.client.w3.eth.block_number
            )
            quorum = await asyncio.to_thread(
                lambda: self.treasury_vault.functions.quorum().call()
            )

            # Check ALL proposals that have both approvals (from event tracking)
            # Also check recent proposals that might just have gotten approved
            candidates = self.rg_approved | self.ys_approved
            # Add recent proposals (last 50) in case events were missed
            candidates.update(range(max(1, proposal_count - 50), proposal_count + 1))

            checked = 0
            for proposal_id in sorted(candidates):
                if proposal_id < 1 or proposal_id > proposal_count:
                    continue
                if proposal_id in self.completed_proposals:
                    continue
                if self.retry_count.get(proposal_id, 0) >= self.max_retries:
                    self.completed_proposals.add(proposal_id)
                    continue

                try:
                    p = await asyncio.to_thread(
                        lambda pid=proposal_id: self.treasury_vault.functions.proposals(pid).call()
                    )
                    # 9-field layout: proposer, target, value, data, deadline, forVotes, againstVotes, executed, cancelled
                    executed = p[7]
                    cancelled = p[8]
                    deadline = p[4]
                    for_votes = p[5]

                    if executed or cancelled:
                        self.completed_proposals.add(proposal_id)
                        continue
                    if current_block > deadline:
                        self.completed_proposals.add(proposal_id)
                        continue

                    # Check approval via events
                    is_rg_approved = proposal_id in self.rg_approved
                    is_ys_approved = proposal_id in self.ys_approved  # always true for created proposals
                    has_quorum = for_votes >= quorum

                    if not is_ys_approved or not is_rg_approved:
                        continue
                    if not has_quorum:
                        continue

                    ready.append({
                        'proposal_id': proposal_id,
                        'target': p[1],
                        'value': p[2],
                        'data': p[3],
                        'deadline': deadline,
                        'for_votes': for_votes,
                    })
                    logger.info(f"Proposal {proposal_id} READY: forVotes={for_votes}, RG approved, YS approved")
                    checked += 1

                except Exception as e:
                    logger.debug(f"Proposal {proposal_id} check error: {e}")

        except Exception as e:
            logger.error(f"Error finding ready proposals: {e}")
        return ready

    async def execute_proposal(self, proposal_id: int) -> bool:
        try:
            # Vote YES first to ensure quorum
            try:
                await self.client.send_transaction(self.treasury_vault, 'vote', [proposal_id, True], self.private_key)
            except Exception as e:
                logger.debug(f"Vote skipped for {proposal_id}: {e}")

            # Execute
            tx_result = await self.client.send_transaction(
                self.treasury_vault, 'executeProposal', [proposal_id], self.private_key
            )
            receipt = tx_result['receipt']
            status = receipt.get('status') or receipt.get('Status')
            if status == 1:
                logger.info(f"✅ Executed proposal {proposal_id}: {tx_result['tx_hash']}")
                self._log_transaction(tx_result['tx_hash'], proposal_id, tx_result['block_number'], tx_result['block_hash'], tx_result['gas_used'])
                # Post message
                try:
                    current_block = await self.client.get_latest_block()
                    keccak = self.client.w3.keccak(text=f"EXECUTED:{tx_result['tx_hash']}")
                    await self.client.send_transaction(
                        self.message_bus, 'postMessage',
                        [proposal_id, 3, 1, current_block['number'], keccak],
                        self.private_key
                    )
                except Exception as e:
                    logger.debug(f"Post-message failed: {e}")
                return True
            else:
                logger.error(f"❌ Execution reverted for proposal {proposal_id}")
                return False
        except Exception as e:
            err_str = str(e)
            if "Proposal expired" in err_str:
                logger.warning(f"Proposal {proposal_id} expired before execution")
            elif "Yield Scout not approved" in err_str:
                logger.warning(f"Proposal {proposal_id}: Yield Scout not approved on-chain")
            elif "Risk Guard not approved" in err_str:
                logger.warning(f"Proposal {proposal_id}: Risk Guard not approved on-chain")
            elif "Execution delay not elapsed" in err_str:
                logger.info(f"Proposal {proposal_id}: execution delay not yet elapsed")
            elif "Quorum not met" in err_str:
                logger.info(f"Proposal {proposal_id}: quorum not met yet")
            else:
                logger.error(f"Execution failed for proposal {proposal_id}: {e}")
            return False

    def _log_transaction(self, tx_hash, proposal_id, block_number, block_hash, gas_used):
        try:
            log_entry = {'timestamp': time.time(), 'tx_hash': tx_hash, 'proposal_id': proposal_id, 'block_number': block_number, 'block_hash': block_hash, 'gas_used': gas_used, 'agent': 'executor'}
            log_file = os.path.join(os.path.dirname(__file__), '..', 'logs', 'transactions.jsonl')
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            with open(log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            logger.error(f"Failed to log transaction: {e}")

    async def run(self) -> None:
        logger.info("Executor agent started (minimal ABI mode)")
        self.control = ControlState()

        def _shutdown(signum, frame):
            logger.info(f"Received signal {signum} — requesting stop")
            self.control.stop()
        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        while True:
            try:
                if self.control.should_stop():
                    logger.info("Stop signal received — shutting down Executor.")
                    return
                if self.control.should_pause():
                    logger.info("Paused via control signal — waiting...")
                    await asyncio.sleep(2)
                    continue

                current_block = await asyncio.to_thread(
                    lambda: self.client.w3.eth.block_number
                )

                # 1. Scan approval events to update tracking
                await self.scan_approval_events()

                # 2. Find proposals ready for execution
                ready = await self.get_ready_proposals()

                if not ready:
                    logger.info(f"Loop @{current_block}: no ready proposals (RG={len(self.rg_approved)}, YS={len(self.ys_approved)}, completed={len(self.completed_proposals)})")

                # 3. Execute each ready proposal
                for proposal in ready:
                    pid = proposal['proposal_id']
                    success = await self.execute_proposal(pid)
                    if success:
                        self.completed_proposals.add(pid)
                    else:
                        self.retry_count[pid] = self.retry_count.get(pid, 0) + 1

                await asyncio.sleep(0.75)

            except KeyboardInterrupt:
                logger.info("Executor agent stopping")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(5)


async def main():
    from config_loader import load_config, load_env, get_contracts_config
    load_env()
    config = load_config()
    contract_config = get_contracts_config(config)
    private_key = os.getenv('EXECUTOR_PRIVATE_KEY')
    if not private_key:
        raise ValueError("EXECUTOR_PRIVATE_KEY environment variable not set")
    w3 = get_botchain_client().w3
    agent_address = w3.eth.account.from_key(private_key).address
    agent = Executor(private_key, agent_address)
    await agent.initialize_contracts(contract_config)
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
Executor Agent — executes approved proposals on-chain
Part of Swarm Treasury multi-agent system

NOTE: The deployed TreasuryVault's proposals() getter returns 9 fields:
  [0] proposer, [1] target, [2] value, [3] data, [4] deadline,
  [5] forVotes, [6] againstVotes, [7] executed, [8] cancelled

  Approval fields (yieldScoutApproved, riskGuardApproved) are in a separate
  getProposalApprovals() function returning [yieldScoutApproved, riskGuardApproved].
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
        'name': 'getProposalApprovals',
        'type': 'function',
        'stateMutability': 'view',
        'inputs': [{'name': 'id', 'type': 'uint256'}],
        'outputs': [
            {'name': 'yieldScoutApproved', 'type': 'bool'},
            {'name': 'riskGuardApproved', 'type': 'bool'},
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
        self.max_retries = 10
        self.voted_proposals: Set[int] = set()  # Proposals we voted on
        self.approval_blocks: Dict[int, int] = {}  # proposal_id -> block when executor first saw both approvals
        self.failed_proposals: Dict[int, int] = {}  # proposal_id -> block of last execution failure (for backoff)

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
        logger.info("Contracts initialized (using 9-field proposals ABI + getProposalApprovals)")

    async def get_ready_proposals(self) -> List[Dict]:
        """Find proposals that are ready for execution.
        Calls proposals() for basic data and getProposalApprovals() for approval status."""
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

            # Only check recent proposals (last 15) to stay fast
            for proposal_id in range(max(1, proposal_count - 15), proposal_count + 1):
                if proposal_id in self.completed_proposals:
                    continue
                if self.retry_count.get(proposal_id, 0) >= self.max_retries:
                    self.completed_proposals.add(proposal_id)
                    continue

                try:
                    # Get proposal data (9 fields)
                    p = await asyncio.to_thread(
                        lambda pid=proposal_id: self.treasury_vault.functions.proposals(pid).call()
                    )
                    executed = p[7]
                    cancelled = p[8]
                    deadline = p[4]
                    for_votes = p[5]

                    if executed or cancelled:
                        self.completed_proposals.add(proposal_id)
                        continue
                    # On-chain execution window = deadline + EXECUTION_WINDOW blocks.
                    # Only give up once we're past that, so late-approved proposals
                    # (which execute well after the voting deadline) are not dropped early.
                    if current_block > deadline + 300:
                        self.completed_proposals.add(proposal_id)
                        continue

                    # Get approval status (separate function)
                    approvals = await asyncio.to_thread(
                        lambda pid=proposal_id: self.treasury_vault.functions.getProposalApprovals(pid).call()
                    )
                    ys_approved = approvals[0]
                    rg_approved = approvals[1]

                    # Both approvals must be on-chain
                    if not ys_approved or not rg_approved:
                        continue

                    # Quorum must be met
                    if for_votes < quorum:
                        # Vote YES to push toward quorum
                        if proposal_id not in self.voted_proposals:
                            try:
                                await self.client.send_transaction(
                                    self.treasury_vault, 'vote', [proposal_id, True], self.private_key
                                )
                                self.voted_proposals.add(proposal_id)
                                logger.info(f"Voted YES on proposal {proposal_id} (forVotes={for_votes})")
                            except Exception as e:
                                if "Already voted" in str(e):
                                    self.voted_proposals.add(proposal_id)
                                logger.debug(f"Vote failed for {proposal_id}: {e}")
                        continue

                    # 1. Check if we recently failed and need to back off (lightweight, just to avoid spamming)
                    if proposal_id in self.failed_proposals:
                        blocks_since_fail = current_block - self.failed_proposals[proposal_id]
                        if blocks_since_fail < 20:
                            logger.debug(f"Proposal {proposal_id}: backing off after failure ({20 - blocks_since_fail} blocks remaining)")
                            continue

                    # Simple checks only - let contract enforce 100-block delay via simulation
                    if proposal_id not in self.approval_blocks:
                        # First time seeing this with both approvals - just track it
                        self.approval_blocks[proposal_id] = current_block

                    # Basic deadline check — keep a small buffer before the on-chain
                    # execution window closes (deadline + 300) so we don't try to fire
                    # a tx that will revert as "execution window passed".
                    if current_block > deadline + 280:
                        logger.debug(f"Proposal {proposal_id}: execution window closing ({deadline + 300 - current_block} blocks left)")
                        self.completed_proposals.add(proposal_id)
                        continue

                    ready.append({
                        'proposal_id': proposal_id,
                        'target': p[1],
                        'value': p[2],
                        'data': p[3],
                        'deadline': deadline,
                        'for_votes': for_votes,
                    })
                    logger.info(f"Proposal {proposal_id} READY: forVotes={for_votes}, RG={rg_approved}, YS={ys_approved}")

                except Exception as e:
                    logger.debug(f"Proposal {proposal_id} check error: {e}")

        except Exception as e:
            logger.error(f"Error finding ready proposals: {e}")
        return ready

    async def execute_proposal(self, proposal_id: int) -> bool:
        try:
            # Simulate first to avoid wasting gas on known failures
            try:
                sim = await asyncio.to_thread(
                    lambda: self.treasury_vault.functions.executeProposal(proposal_id).call(
                        {'from': self.agent_address}
                    )
                )
            except Exception as sim_e:
                err_str = str(sim_e)
                if "Execution delay not elapsed" in err_str:
                    logger.debug(f"Proposal {proposal_id}: execution delay not yet elapsed — skipping tx")
                    return None  # retry next loop
                elif "Quorum not met" in err_str:
                    logger.debug(f"Proposal {proposal_id}: quorum not met yet")
                    return None
                elif "Proposal expired" in err_str:
                    logger.warning(f"Proposal {proposal_id} expired — marking as completed")
                    self.completed_proposals.add(proposal_id)
                    return False
                elif "not approved" in err_str:
                    logger.warning(f"Proposal {proposal_id}: missing approval — {err_str[:80]}")
                    return False
                else:
                    logger.debug(f"Proposal {proposal_id}: simulation failed: {err_str[:120]}")

            # If simulation raised an exception, we already returned above
            # If we reach here, simulation succeeded - execute the real transaction
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
                # Record failure time for backoff
                current_block = await asyncio.to_thread(lambda: self.client.w3.eth.block_number)
                self.failed_proposals[proposal_id] = current_block
                return False
        except Exception as e:
            err_str = str(e)
            if "Proposal expired" in err_str:
                logger.warning(f"Proposal {proposal_id} expired — marking as completed")
                self.completed_proposals.add(proposal_id)
            elif "Yield Scout not approved" in err_str:
                logger.warning(f"Proposal {proposal_id}: Yield Scout not approved on-chain")
            elif "Risk Guard not approved" in err_str:
                logger.warning(f"Proposal {proposal_id}: Risk Guard not approved on-chain")
            elif "Execution delay not elapsed" in err_str:
                logger.debug(f"Proposal {proposal_id}: execution delay not yet elapsed — will retry")
                # Don't increment retry count for delay errors
                return None  # signal: retry without penalty
            elif "Quorum not met" in err_str:
                logger.debug(f"Proposal {proposal_id}: quorum not met yet")
            else:
                logger.error(f"Execution error for proposal {proposal_id}: {e}")
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
        logger.info("Executor agent started (9-field ABI + getProposalApprovals, on-chain approval checks)")
        self.control = ControlState()

        self._sig_stop = False

        def _shutdown(signum, frame):
            logger.info(f"Received signal {signum} — shutting down locally")
            self._sig_stop = True
        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        while True:
            try:
                if self._sig_stop or self.control.should_stop():
                    logger.info("Stop signal received — shutting down Executor.")
                    return
                if self.control.should_pause():
                    logger.info("Paused via control signal — waiting...")
                    await asyncio.sleep(2)
                    continue

                current_block = await asyncio.to_thread(
                    lambda: self.client.w3.eth.block_number
                )

                # Find proposals ready for execution (reads on-chain approvals directly)
                ready = await self.get_ready_proposals()

                if not ready:
                    logger.info(f"Loop @{current_block}: no ready proposals (completed={len(self.completed_proposals)})")

                # Execute each ready proposal
                for proposal in ready:
                    pid = proposal['proposal_id']
                    result = await self.execute_proposal(pid)
                    if result is True:
                        self.completed_proposals.add(pid)
                    elif result is None:
                        pass  # delay not elapsed — retry next loop without penalty
                    else:
                        self.retry_count[pid] = self.retry_count.get(pid, 0) + 1
                        if self.retry_count[pid] >= self.max_retries:
                            self.completed_proposals.add(pid)
                            logger.warning(f"Proposal {pid} exhausted retries — skipping")

                await asyncio.sleep(0.75)

            except KeyboardInterrupt:
                logger.info("Executor agent stopping")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(5)


async def main():
    from config_loader import load_config, load_env, get_contracts_config
    from keepalive import start_keepalive

    load_env()
    cfg, contracts = load_config()
    contract_config = get_contracts_config(contracts, cfg["abis"])

    port = int(os.getenv("PORT", "8000"))
    start_keepalive(port, "executor")

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

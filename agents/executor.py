#!/usr/bin/env python3
"""
Executor Agent — executes approved proposals on-chain
Part of Swarm Treasury multi-agent system
"""

import asyncio
import json
import logging
import os
import time
from typing import Dict, Any, List, Optional

from botchain_client import BotChainClient, get_botchain_client
from control_state import ControlState

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","message":"%(message)s","module":"botchain_client"}'
)
logger = logging.getLogger(__name__)


class ApprovedAction:
    """An action approved for execution"""
    def __init__(self, proposal_id: int, target: str, value: int, data: bytes, block_number: int):
        self.proposal_id = proposal_id
        self.target = target
        self.value = value
        self.data = data
        self.block_number = block_number


class Executor:
    def __init__(self, private_key: str, agent_address: str):
        self.private_key = private_key
        self.agent_address = agent_address
        self.client: BotChainClient = get_botchain_client()
        self.treasury_vault = None
        self.message_bus = None
        self.agent_registry = None
        self.processed_proposals: Dict[int, bool] = {}
        self.pending_actions: Dict[int, ApprovedAction] = {}
        self.retry_count: Dict[int, int] = {}
        self.max_retries = 3

    async def initialize_contracts(self, config: Dict[str, Any]) -> None:
        self.treasury_vault = self.client.load_contract('TreasuryVault', config['treasury_vault_address'], config['treasury_vault_abi'])
        self.message_bus = self.client.load_contract('MessageBus', config['message_bus_address'], config['message_bus_abi'])
        self.agent_registry = self.client.load_contract('AgentRegistry', config['agent_registry_address'], config['agent_registry_abi'])
        logger.info("Contracts initialized successfully")

    async def check_approved_proposals(self) -> List[ApprovedAction]:
        approved_actions = []
        try:
            proposal_count = self.treasury_vault.functions.proposalCount().call()
            for proposal_id in range(1, proposal_count + 1):
                if proposal_id not in self.processed_proposals:
                    proposal = self.treasury_vault.functions.proposals(proposal_id).call()
                    executed = proposal[7]
                    cancelled = proposal[8]
                    if not executed and not cancelled:
                            action = ApprovedAction(proposal_id, proposal[1], proposal[2], proposal[3], 0)
                            approved_actions.append(action)
                            self.processed_proposals[proposal_id] = False
        except Exception as e:
            logger.error(f"Error checking approved proposals: {e}")
        return approved_actions

    async def execute_action(self, action: ApprovedAction) -> bool:
        try:
            # Vote YES first to ensure quorum
            try:
                await self.client.send_transaction(self.treasury_vault, 'vote', [action.proposal_id, True], self.private_key)
            except:
                pass

            tx_result = await self.client.send_transaction(self.treasury_vault, 'executeProposal', [action.proposal_id], self.private_key)

            receipt = tx_result['receipt']
            status = receipt.get('status') or receipt.get('Status')
            if status == 1:
                self.pending_actions[action.proposal_id] = action
                self.retry_count[action.proposal_id] = 0
                current_block = await self.client.get_latest_block()
                await self._post_message(action.proposal_id, 3, 1, current_block['number'], self.client.w3.keccak(text=f"EXECUTED:{tx_result['tx_hash']}"))
                self._log_transaction(tx_result['tx_hash'], action.proposal_id, tx_result['block_number'], tx_result['block_hash'], tx_result['gas_used'])
                logger.info(f"Executed proposal {action.proposal_id}: {tx_result['tx_hash']}")
                return True
            else:
                logger.error(f"Execution failed for proposal {action.proposal_id}")
                return False
        except Exception as e:
            logger.error(f"Failed to execute proposal {action.proposal_id}: {e}")
            return False

    async def _post_message(self, proposal_id, agent_role, message_type, block_number, data_hash):
        try:
            await self.client.send_transaction(self.message_bus, 'postMessage', [proposal_id, agent_role, message_type, block_number, data_hash], self.private_key)
        except Exception as e:
            logger.error(f"Failed to post message: {e}")

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
        logger.info("Executor agent started")
        self.control = ControlState()
        while True:
            try:
                # --- bot control plane ---
                if self.control.should_stop():
                    logger.info("Stop signal received — shutting down Executor.")
                    return
                if self.control.should_pause():
                    logger.info("Paused via control signal — waiting...")
                    await asyncio.sleep(2)
                    continue

                approved_actions = await self.check_approved_proposals()
                for action in approved_actions:
                    await self.execute_action(action)
                    self.processed_proposals[action.proposal_id] = True
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

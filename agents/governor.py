#!/usr/bin/env python3
"""
Governor Agent - Human-in-loop for large moves and emergency actions
Part of Swarm Treasury multi-agent system
"""

import asyncio
import json
import logging
import os
import signal
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from botchain_client import get_botchain_client
from control_state import ControlState

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","message":"%(message)s","agent":"governor"}'
)
logger = logging.getLogger(__name__)


@dataclass
class PendingApproval:
    """Pending approval request"""
    proposal_id: int
    amount: int
    asset: str
    strategy: str
    expected_apy: int
    simulated_slippage: float
    timestamp: float
    

class Governor:
    """
    Governor Agent - Human-in-loop for large moves and emergency actions
    """
    
    def __init__(self, private_key: str, agent_address: str):
        """
        Initialize Governor agent
        
        Args:
            private_key: Agent's private key
            agent_address: Agent's address
        """
        self.private_key = private_key
        self.agent_address = agent_address
        self.client = get_botchain_client()
        
        # Configuration
        self.large_move_threshold = 0.2  # 20%
        self.approval_timeout = 30  # seconds
        
        # State
        self.pending_approvals: Dict[int, PendingApproval] = {}
        self.processed_alerts: Dict[int, bool] = {}
        
        # Contract references
        self.treasury_vault: Optional[Any] = None
        self.message_bus: Optional[Any] = None
        self.agent_registry: Optional[Any] = None
        self.governor_contract: Optional[Any] = None
        
        logger.info(f"Governor agent initialized at {agent_address}")
    
    async def initialize_contracts(self, config: Dict[str, Any]) -> None:
        """Initialize contract references"""
        try:
            self.treasury_vault = self.client.load_contract(
                'TreasuryVault',
                config['treasury_vault_address'],
                config['treasury_vault_abi']
            )
            
            self.message_bus = self.client.load_contract(
                'MessageBus',
                config['message_bus_address'],
                config['message_bus_abi']
            )
            
            self.agent_registry = self.client.load_contract(
                'AgentRegistry',
                config['agent_registry_address'],
                config['agent_registry_abi']
            )
            
            self.governor_contract = self.client.load_contract(
                'Governor',
                config['governor_address'],
                config['governor_abi']
            )
            
            logger.info("Contracts initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize contracts: {e}")
            raise
    
    async def check_large_moves(self) -> List[PendingApproval]:
        """
        Check for large moves requiring Governor approval
        
        Returns:
            List of pending approval requests
        """
        pending = []
        
        try:
            # Get current proposal count
            proposal_count = self.treasury_vault.functions.proposalCount().call()
            
            for proposal_id in range(1, proposal_count + 1):
                if proposal_id not in self.pending_approvals:
                    proposal = self.treasury_vault.functions.proposals(proposal_id).call()
                    
                    # Check if this is a large move
                    if self._is_large_move(proposal):
                        # Extract details from proposal
                        try:
                            decoded = self.treasury_vault.decode_function_input(proposal[3])  # data
                            strategy_address = decoded[0]
                            amount = decoded[1]
                        except:
                            strategy_address = proposal[2]  # target
                            amount = proposal[1]  # value
                        
                        # Get strategy config for APY
                        try:
                            strategy_config = self.treasury_vault.functions.strategyConfig(strategy_address).call()
                            apy_bps = strategy_config[4]  # minReturnBps
                        except:
                            apy_bps = 0
                        
                        approval = PendingApproval(
                            proposal_id=proposal_id,
                            amount=amount,
                            asset=strategy_config[0] if strategy_config else proposal[2],
                            strategy=strategy_address,
                            expected_apy=apy_bps,
                            simulated_slippage=0.005,  # Default 0.5%
                            timestamp=time.time()
                        )
                        
                        pending.append(approval)
                        self.pending_approvals[proposal_id] = approval
            
        except Exception as e:
            logger.error(f"Error checking large moves: {e}")
        
        return pending
    
    def _is_large_move(self, proposal: tuple) -> bool:
        """
        Check if a proposal represents a large move by decoding the calldata
        and comparing the amount against the treasury balance.
        """
        try:
            target = proposal[1]   # target address
            data = proposal[3]     # calldata bytes

            # Decode the function call from calldata
            try:
                func, params = self.treasury_vault.decode_function_input(data)
            except Exception:
                return False

            func_name = func.fn_name if hasattr(func, 'fn_name') else ''

            if func_name == 'depositToStrategy':
                strategy_address = params.get('strategy', params.get('strategyAddress'))
                amount = params.get('amount', 0)
                # Get asset from strategy config
                strategy_config = self.treasury_vault.functions.strategyConfig(strategy_address).call()
                asset = strategy_config[0]
                treasury_balance = self.treasury_vault.functions.treasuryBalance(asset).call()
                if treasury_balance > 0:
                    return (amount * 100) / treasury_balance >= (self.large_move_threshold * 100)

            elif func_name == 'withdraw':
                asset = params.get('asset')
                amount = params.get('amount', 0)
                treasury_balance = self.treasury_vault.functions.treasuryBalance(asset).call()
                if treasury_balance > 0:
                    return (amount * 100) / treasury_balance >= (self.large_move_threshold * 100)

        except Exception as e:
            logger.error(f"Error checking large move: {e}")

        return False
    
    async def request_approval(self, approval: PendingApproval) -> bool:
        """
        Request approval from human Governor
        
        Args:
            approval: Pending approval request
            
        Returns:
            True if approved, False if vetoed or timeout
        """
        try:
            # Send desktop notification
            self._send_notification(approval)
            
            # Show CLI prompt
            print(f"\n{'='*60}")
            print("GOVERNOR APPROVAL REQUIRED")
            print(f"{'='*60}")
            print(f"Proposal ID: {approval.proposal_id}")
            print(f"Action: Invest {approval.amount / 10**18} {approval.asset}")
            print(f"Strategy: {approval.strategy}")
            print(f"Expected APY: {approval.expected_apy / 100}%")
            print(f"Simulated Slippage: {approval.simulated_slippage:.2%}")
            print(f"{'='*60}")
            
            # Start timeout
            start_time = time.time()
            
            while time.time() - start_time < self.approval_timeout:
                try:
                    # Check for user input
                    response = input("Approve [Y/n]: ").strip().lower()
                    
                    if response in ['y', 'yes', '']:
                        # Approve — vote YES
                        await self._vote_proposal(approval.proposal_id, True)
                        logger.info(f"Governor voted YES on proposal {approval.proposal_id}")
                        return True
                    elif response in ['n', 'no']:
                        # Veto — vote NO
                        await self._vote_proposal(approval.proposal_id, False)
                        logger.info(f"Governor voted NO on proposal {approval.proposal_id}")
                        return False
                    else:
                        print("Please enter 'Y' for yes or 'N' for no")
                        
                except (KeyboardInterrupt, EOFError):
                    # Timeout
                    break
            
            # Timeout - auto-vote NO
            await self._vote_proposal(approval.proposal_id, False)
            logger.info(f"Auto-voted NO on proposal {approval.proposal_id} (timeout)")
            return False
            
        except Exception as e:
            logger.error(f"Error in approval request: {e}")
            return False
    
    def _send_notification(self, approval: PendingApproval) -> None:
        """Send desktop notification (best-effort, skipped on headless servers)"""
        try:
            from plyer import notification
            title = "Swarm Treasury - Approval Required"
            message = f"Proposal {approval.proposal_id}: Invest {approval.amount / 10**18} {approval.asset} at {approval.expected_apy / 100}% APY"
            
            notification.notify(
                title=title,
                message=message,
                app_name="Swarm Treasury",
                timeout=10
            )
        except Exception as e:
            logger.warning(f"Failed to send desktop notification: {e}")
    
    async def _vote_proposal(self, proposal_id: int, support: bool) -> None:
        """Vote on a proposal"""
        try:
            await self.client.send_transaction(
                self.treasury_vault,
                'vote',
                [proposal_id, support],
                self.private_key
            )

            # Post vote message
            current_block = await self.client.get_latest_block()
            await self._post_message(
                proposal_id,
                4,  # GOVERNOR_ROLE
                1,  # APPROVAL message type
                current_block['number'],
                self.client.w3.keccak(text=f"GOVERNOR_VOTED:{'YES' if support else 'NO'}")
            )

        except Exception as e:
            logger.error(f"Failed to vote on proposal {proposal_id}: {e}")
    
    async def _veto_proposal(self, proposal_id: int, reason: str) -> None:
        """Veto a proposal"""
        try:
            await self.client.send_transaction(
                self.treasury_vault,
                'vetoProposal',
                [proposal_id, reason],
                self.private_key
            )
            
            # Post veto message
            current_block = await self.client.get_latest_block()
            await self._post_message(
                proposal_id,
                4,  # GOVERNOR_ROLE
                2,  # VETO message type
                current_block['number'],
                self.client.w3.keccak(text=f"GOVERNOR_VETOED:{reason}")
            )
            
        except Exception as e:
            logger.error(f"Failed to veto proposal {proposal_id}: {e}")
    
    async def emergency_pause(self) -> None:
        """Trigger emergency pause across all contracts"""
        try:
            # Pause TreasuryVault
            await self.client.send_transaction(
                self.treasury_vault,
                'pause',
                [],
                self.private_key
            )
            
            # Pause via Governor contract
            await self.client.send_transaction(
                self.governor_contract,
                'emergencyPause',
                [],
                self.private_key
            )
            
            logger.info("Emergency pause triggered across all contracts")
            
            # Send notification (best-effort)
            try:
                from plyer import notification
                notification.notify(
                    title="Swarm Treasury - EMERGENCY PAUSE",
                    message="All contracts have been paused by Governor",
                    app_name="Swarm Treasury",
                    timeout=10
                )
            except Exception:
                pass
            
        except Exception as e:
            logger.error(f"Failed to trigger emergency pause: {e}")
    
    async def emergency_unpause(self) -> None:
        """Lift emergency pause across all contracts"""
        try:
            # Unpause TreasuryVault
            await self.client.send_transaction(
                self.treasury_vault,
                'unpause',
                [],
                self.private_key
            )
            
            # Unpause via Governor contract
            await self.client.send_transaction(
                self.governor_contract,
                'emergencyUnpause',
                [],
                self.private_key
            )
            
            logger.info("Emergency pause lifted across all contracts")
            
        except Exception as e:
            logger.error(f"Failed to lift emergency pause: {e}")
    
    async def _post_message(
        self, 
        proposal_id: int, 
        agent_role: int, 
        message_type: int, 
        block_number: int, 
        data_hash: bytes
    ) -> None:
        """Post a message to MessageBus"""
        try:
            await self.client.send_transaction(
                self.message_bus,
                'postMessage',
                [proposal_id, agent_role, message_type, block_number, data_hash],
                self.private_key
            )
        except Exception as e:
            logger.error(f"Failed to post message: {e}")
    
    async def run(self) -> None:
        """Main agent loop"""
        logger.info("Governor agent started")
        self.control = ControlState()

        # Graceful shutdown on SIGTERM (Docker/Render) and SIGINT (Ctrl+C)
        def _shutdown(signum, frame):
            logger.info(f"Received signal {signum} — requesting stop")
            self.control.stop()
        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        while True:
            try:
                # --- bot control plane ---
                if self.control.should_stop():
                    logger.info("Stop signal received — shutting down Governor.")
                    return
                if self.control.should_pause():
                    logger.info("Paused via control signal — waiting...")
                    await asyncio.sleep(2)
                    continue

                # Vote on all new proposals that need votes
                proposal_count = self.treasury_vault.functions.proposalCount().call()
                for proposal_id in range(1, proposal_count + 1):
                    if proposal_id not in self.processed_alerts:
                        proposal = self.treasury_vault.functions.proposals(proposal_id).call()
                        executed = proposal[7]
                        cancelled = proposal[8]
                        if not executed and not cancelled:
                            # Auto-vote YES to ensure quorum
                            try:
                                await self.client.send_transaction(
                                    self.treasury_vault, 'vote', [proposal_id, True],
                                    self.private_key
                                )
                                logger.info(f"Voted YES on proposal {proposal_id}")
                            except Exception as e:
                                logger.debug(f"Vote skipped for proposal {proposal_id}: {e}")
                        self.processed_alerts[proposal_id] = True

                # Check for large moves requiring approval
                pending = await self.check_large_moves()
                for approval in pending:
                    await self.request_approval(approval)
                    self.processed_alerts[approval.proposal_id] = True
                
                await asyncio.sleep(0.75)
                
            except (KeyboardInterrupt, EOFError):
                logger.info("Governor agent stopping")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(5)


async def main():
    """Main entry point"""
    from config_loader import load_config, load_env, get_contracts_config

    load_env()
    config = load_config()
    contract_config = get_contracts_config(config)

    # Get private key from environment
    private_key = os.getenv('GOVERNOR_PRIVATE_KEY')
    if not private_key:
        raise ValueError("GOVERNOR_PRIVATE_KEY environment variable not set")
    
    # Derive address from private key
    w3 = get_botchain_client().w3
    agent_address = w3.eth.account.from_key(private_key).address
    
    # Create and run agent
    agent = Governor(private_key, agent_address)
    await agent.initialize_contracts(contract_config)
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())

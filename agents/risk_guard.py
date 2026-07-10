#!/usr/bin/env python3
"""
Risk Guard Agent - Simulates slippage and approves/vetoes proposals
Part of Swarm Treasury multi-agent system
"""

import asyncio
import json
import logging
import os
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from botchain_client import get_botchain_client
from control_state import ControlState

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","message":"%(message)s","agent":"risk_guard"}'
)
logger = logging.getLogger(__name__)


@dataclass
class RiskAssessment:
    """Risk assessment result"""
    proposal_id: int
    slippage_percent: float
    impermanent_loss_risk: float
    overall_risk_score: float
    approved: bool
    reason: str
    

class RiskGuard:
    """
    Risk Guard Agent - Simulates slippage and approves/vetoes proposals
    """
    
    def __init__(self, private_key: str, agent_address: str):
        """
        Initialize Risk Guard agent
        
        Args:
            private_key: Agent's private key
            agent_address: Agent's address
        """
        self.private_key = private_key
        self.agent_address = agent_address
        self.client = get_botchain_client()
        
        # Configuration
        self.max_slippage = 0.005  # 0.5%
        self.max_risk_score = 0.7  # 70%
        self.consecutive_veto_limit = 3
        
        # State
        self.consecutive_vetoes = 0
        self.paused_until_block = 0
        self.processed_proposals: Dict[int, bool] = {}  # proposal_id -> processed
        
        # Contract references
        self.treasury_vault: Optional[Any] = None
        self.message_bus: Optional[Any] = None
        self.agent_registry: Optional[Any] = None
        
        logger.info(f"Risk Guard agent initialized at {agent_address}")
    
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
            
            logger.info("Contracts initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize contracts: {e}")
            raise
    
    async def check_new_proposals(self) -> List[int]:
        """
        Check for new proposals that need risk assessment
        
        Returns:
            List of proposal IDs needing assessment
        """
        new_proposals = []
        
        try:
            # Get current proposal count
            proposal_count = self.treasury_vault.functions.proposalCount().call()
            
            # Check proposals we haven't processed yet
            for proposal_id in range(1, proposal_count + 1):
                if proposal_id not in self.processed_proposals:
                    proposal = self.treasury_vault.functions.proposals(proposal_id).call()
                    
                    # Only process proposals that haven't been executed or cancelled
                    if not proposal[7] and not proposal[8]:  # executed, cancelled
                        new_proposals.append(proposal_id)
                        self.processed_proposals[proposal_id] = False
            
        except Exception as e:
            logger.error(f"Error checking new proposals: {e}")
        
        return new_proposals
    
    async def assess_risk(self, proposal_id: int) -> RiskAssessment:
        """
        Assess risk for a proposal
        
        Args:
            proposal_id: Proposal ID to assess
            
        Returns:
            Risk assessment result
        """
        try:
            # Get proposal details
            proposal = self.treasury_vault.functions.proposals(proposal_id).call()
            
            # Decode the proposal data to get strategy and amount
            # The data should be encoded call to depositToStrategy
            try:
                decoded = self.treasury_vault.decode_function_input(proposal[3])  # data
                strategy_address = decoded[0]
                amount = decoded[1]
            except:
                # Fallback - use target as strategy
                strategy_address = proposal[1]  # target
                amount = proposal[2]  # value
            
            # Get strategy config
            strategy_config = self.treasury_vault.functions.strategyConfig(strategy_address).call()
            
            # Simulate slippage (for demo, use a simple calculation)
            # In production, this would query the actual pool state
            asset_balance = self.treasury_vault.functions.treasuryBalance(strategy_config[0]).call()
            
            # Calculate slippage based on amount relative to liquidity
            # This is a simplified simulation
            if asset_balance > 0:
                slippage_percent = (amount * 0.001) / asset_balance  # 0.1% per unit of relative size
            else:
                slippage_percent = 0.01  # 1% if no liquidity data
            
            # Calculate impermanent loss risk (simplified)
            # Based on APY and time horizon
            apy_bps = strategy_config[4]  # minReturnBps
            il_risk = min(apy_bps / 10000.0, 0.5)  # Cap at 50%
            
            # Overall risk score (0-1)
            overall_risk = min(slippage_percent / self.max_slippage + il_risk, 1.0)
            
            # Determine approval
            approved = (slippage_percent <= self.max_slippage and 
                       il_risk <= self.max_risk_score and
                       overall_risk <= self.max_risk_score)
            
            reason = "Approved: Low risk" if approved else f"Rejected: High slippage ({slippage_percent:.2%}) or IL risk ({il_risk:.2%})"
            
            return RiskAssessment(
                proposal_id=proposal_id,
                slippage_percent=slippage_percent,
                impermanent_loss_risk=il_risk,
                overall_risk_score=overall_risk,
                approved=approved,
                reason=reason
            )
            
        except Exception as e:
            logger.error(f"Error assessing risk for proposal {proposal_id}: {e}")
            return RiskAssessment(
                proposal_id=proposal_id,
                slippage_percent=1.0,
                impermanent_loss_risk=1.0,
                overall_risk_score=1.0,
                approved=False,
                reason=f"Assessment error: {e}"
            )
    
    async def approve_proposal(self, proposal_id: int, assessment: RiskAssessment) -> bool:
        """
        Approve a proposal
        
        Args:
            proposal_id: Proposal ID to approve
            assessment: Risk assessment result
            
        Returns:
            True if approved, False otherwise
        """
        try:
            # Check if we're in circuit breaker mode
            current_block = await self.client.get_latest_block()
            if current_block['number'] <= self.paused_until_block:
                logger.warning(f"Circuit breaker active until block {self.paused_until_block}")
                return False
            
            if assessment.approved:
                # Approve the proposal
                tx_result = await self.client.send_transaction(
                    self.treasury_vault,
                    'approveProposal',
                    [proposal_id],
                    self.private_key
                )
                
                # Reset consecutive vetoes
                self.consecutive_vetoes = 0
                
                # Post approval message
                await self._post_message(
                    proposal_id,
                    2,  # RISK_GUARD_ROLE
                    1,  # APPROVAL message type
                    current_block['number'],
                    self.client.w3.keccak(text=f"APPROVED:{assessment.reason}")
                )
                
                logger.info(f"Approved proposal {proposal_id}: {assessment.reason}")
                return True
            else:
                # Veto the proposal
                tx_result = await self.client.send_transaction(
                    self.treasury_vault,
                    'vetoProposal',
                    [proposal_id, assessment.reason],
                    self.private_key
                )
                
                # Increment consecutive vetoes
                self.consecutive_vetoes += 1
                
                # Check circuit breaker
                if self.consecutive_vetoes >= self.consecutive_veto_limit:
                    self.paused_until_block = current_block['number'] + 10
                    logger.warning(f"Circuit breaker triggered! Paused until block {self.paused_until_block}")
                
                # Post veto message
                await self._post_message(
                    proposal_id,
                    2,  # RISK_GUARD_ROLE
                    2,  # VETO message type
                    current_block['number'],
                    self.client.w3.keccak(text=f"VETOED:{assessment.reason}")
                )
                
                logger.info(f"Vetoed proposal {proposal_id}: {assessment.reason}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to process proposal {proposal_id}: {e}")
            return False
    
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
        logger.info("Risk Guard agent started")
        self.control = ControlState()

        while True:
            try:
                # --- bot control plane ---
                if self.control.should_stop():
                    logger.info("Stop signal received — shutting down Risk Guard.")
                    return
                if self.control.should_pause():
                    logger.info("Paused via control signal — waiting...")
                    await asyncio.sleep(2)
                    continue

                new_proposals = await self.check_new_proposals()
                
                for proposal_id in new_proposals:
                    # Assess risk
                    assessment = await self.assess_risk(proposal_id)
                    
                    # Approve or veto
                    await self.approve_proposal(proposal_id, assessment)
                    
                    # Mark as processed
                    self.processed_proposals[proposal_id] = True
                
                # Sleep for block time
                await asyncio.sleep(0.75)
                
            except KeyboardInterrupt:
                logger.info("Risk Guard agent stopping")
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
    private_key = os.getenv('RISK_GUARD_PRIVATE_KEY')
    if not private_key:
        raise ValueError("RISK_GUARD_PRIVATE_KEY environment variable not set")
    
    # Derive address from private key
    w3 = get_botchain_client().w3
    agent_address = w3.eth.account.from_key(private_key).address
    
    # Create and run agent
    agent = RiskGuard(private_key, agent_address)
    await agent.initialize_contracts(contract_config)
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
Yield Scout Agent - Monitors yield opportunities and creates proposals
Part of Swarm Treasury multi-agent system
"""

import asyncio
import json
import logging
import os
import signal
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

from botchain_client import get_botchain_client, BotChainClient
from control_state import ControlState

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","message":"%(message)s","agent":"yield_scout"}'
)
logger = logging.getLogger(__name__)


@dataclass
class YieldOpportunity:
    """Yield opportunity data"""
    strategy_address: str
    apy_bps: int  # APY in basis points (e.g., 1200 = 12%)
    asset: str
    min_investment: int
    max_investment: int
    risk_score: float
    slippage_estimate: float
    

@dataclass
class Proposal:
    """Proposal data"""
    proposal_id: int
    strategy_address: str
    amount: int
    apy_bps: int
    block_number: int
    timestamp: float
    description: str
    

class YieldScout:
    """
    Yield Scout Agent - Monitors yield opportunities and creates proposals
    """
    
    def __init__(self, private_key: str, agent_address: str):
        """
        Initialize Yield Scout agent
        
        Args:
            private_key: Agent's private key
            agent_address: Agent's address
        """
        self.private_key = private_key
        self.agent_address = agent_address
        self.client = get_botchain_client()
        
        # Configuration
        self.poll_interval = 120  # blocks (~90s — slows proposal creation to conserve gas on testnet)
        self.apy_threshold = 1000  # 10% in basis points
        self.min_investment = 5_000 * 10**18  # 5k tokens — stays well under 20% single-move cap
        
        # State
        self.last_poll_block = 0
        self.proposals: Dict[int, Proposal] = {}
        self.processed_strategies: Dict[str, int] = {}  # strategy -> last block processed
        
        # Contract references
        self.treasury_vault: Optional[Any] = None
        self.message_bus: Optional[Any] = None
        self.agent_registry: Optional[Any] = None
        
        logger.info(f"Yield Scout agent initialized at {agent_address}")
    
    async def initialize_contracts(self, config: Dict[str, Any]) -> None:
        """
        Initialize contract references
        
        Args:
            config: Configuration with contract addresses and ABIs
        """
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
    
    async def scan_yield_opportunities(self) -> List[YieldOpportunity]:
        """
        Scan for yield opportunities from registered strategies
        
        Returns:
            List of yield opportunities
        """
        opportunities = []
        
        try:
            # Get registered strategies from TreasuryVault
            strategy_count = self.treasury_vault.functions.strategyCount().call()
            
            for i in range(strategy_count):
                strategy_address = self.treasury_vault.functions.strategies(i).call()
                
                # Skip if we've already processed this strategy in current window
                if strategy_address in self.processed_strategies:
                    continue
                
                # Get strategy config
                config = self.treasury_vault.functions.strategyConfig(strategy_address).call()
                
                if not config[3]:  # active
                    continue
                
                # Get APY from strategy
                strategy_contract = self.client.load_contract(
                    f'strategy_{strategy_address}',
                    strategy_address,
                    [
                        {
                            'inputs': [],
                            'name': 'getAPY',
                            'outputs': [{'type': 'uint256'}],
                            'type': 'function'
                        }
                    ]
                )
                
                apy_bps = strategy_contract.functions.getAPY().call()
                
                # Check if APY meets threshold
                if apy_bps >= self.apy_threshold:
                    opportunity = YieldOpportunity(
                        strategy_address=strategy_address,
                        apy_bps=apy_bps,
                        asset=config[0],
                        min_investment=self.min_investment,
                        max_investment=config[1],  # maxAllocation
                        risk_score=0.5,  # Placeholder - would be calculated
                        slippage_estimate=0.005  # 0.5% estimated slippage
                    )
                    opportunities.append(opportunity)
                    logger.info(f"Found yield opportunity: {apy_bps/100}% APY at {strategy_address}")
                
                # Mark as processed
                self.processed_strategies[strategy_address] = self.last_poll_block
            
        except Exception as e:
            logger.error(f"Error scanning yield opportunities: {e}")
        
        return opportunities
    
    async def create_proposal(self, opportunity: YieldOpportunity) -> Optional[Proposal]:
        """
        Create a proposal for a yield opportunity
        
        Args:
            opportunity: Yield opportunity to propose
            
        Returns:
            Created proposal or None if failed
        """
        try:
            # Check treasury balance
            asset_balance = self.treasury_vault.functions.treasuryBalance(opportunity.asset).call()
            
            if asset_balance < opportunity.min_investment:
                logger.warning(f"Insufficient balance for {opportunity.asset}: {asset_balance}")
                return None
            
            # Calculate amount to invest (up to max allocation)
            amount = min(opportunity.min_investment, opportunity.max_investment, asset_balance)
            
            # Build proposal description
            description = f"Invest {amount/10**18} {opportunity.asset} in {opportunity.strategy_address} for {opportunity.apy_bps/100}% APY"
            
            # Create proposal on TreasuryVault
            current_block = await self.client.get_latest_block()
            
            tx_result = await self.client.send_transaction(
                self.treasury_vault,
                'createProposal',
                [
                    self.treasury_vault.address,
                    0,  # value (native token)
                    self.treasury_vault.encode_abi(
                        'depositToStrategy',
                        args=[opportunity.strategy_address, amount]
                    ),
                    description
                ],
                self.private_key
            )
            
            # Get proposal ID from events
            proposal_id = self._get_proposal_id_from_receipt(tx_result['receipt'])
            
            if proposal_id:
                proposal = Proposal(
                    proposal_id=proposal_id,
                    strategy_address=opportunity.strategy_address,
                    amount=amount,
                    apy_bps=opportunity.apy_bps,
                    block_number=current_block['number'],
                    timestamp=time.time(),
                    description=description
                )
                
                self.proposals[proposal_id] = proposal
                
                # Post message to MessageBus
                await self._post_message(
                    proposal_id,
                    1,  # YIELD_SCOUT_ROLE
                    0,  # PROPOSAL message type
                    current_block['number'],
                    self.client.w3.keccak(text=description)
                )
                
                logger.info(f"Created proposal {proposal_id}: {description}")
                return proposal
            
        except Exception as e:
            logger.error(f"Failed to create proposal: {e}")
        
        return None
    
    def _get_proposal_id_from_receipt(self, receipt: Dict[str, Any]) -> Optional[int]:
        """Extract proposal ID from transaction receipt"""
        try:
            for log in receipt['logs']:
                if log['topics'][0].hex() == self.treasury_vault.events.ProposalCreated.topic:
                    return int.from_bytes(log['topics'][1], 'big')
        except Exception as e:
            logger.error(f"Error parsing proposal ID from receipt: {e}")
        return None
    
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
        logger.info("Yield Scout agent started")
        self.control = ControlState()

        # Graceful shutdown on SIGTERM (Docker/Render) and SIGINT (Ctrl+C)
        self._sig_stop = False

        def _shutdown(signum, frame):
            logger.info(f"Received signal {signum} — shutting down locally")
            self._sig_stop = True
        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        while True:
            try:
                # --- bot control plane ---
                if self._sig_stop or self.control.should_stop():
                    logger.info("Stop signal received — shutting down Yield Scout.")
                    return
                if self.control.should_pause():
                    logger.info("Paused via control signal — waiting...")
                    await asyncio.sleep(2)
                    continue

                # Get current block
                current_block = await self.client.get_latest_block()
                current_block_number = current_block['number']
                
                # Check if we should poll (every 30 blocks)
                if current_block_number >= self.last_poll_block + self.poll_interval:
                    self.last_poll_block = current_block_number
                    
                    # Clear processed strategies for new window
                    self.processed_strategies.clear()
                    
                    # Scan for opportunities
                    opportunities = await self.scan_yield_opportunities()
                    
                    # Create proposals for opportunities
                    for opportunity in opportunities:
                        await self.create_proposal(opportunity)
                
                # Sleep for block time
                await asyncio.sleep(0.75)
                
            except KeyboardInterrupt:
                logger.info("Yield Scout agent stopping")
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
    private_key = os.getenv('YIELD_SCOUT_PRIVATE_KEY')
    if not private_key:
        raise ValueError("YIELD_SCOUT_PRIVATE_KEY environment variable not set")
    
    # Derive address from private key
    w3 = get_botchain_client().w3
    agent_address = w3.eth.account.from_key(private_key).address
    
    # Create and run agent
    agent = YieldScout(private_key, agent_address)
    await agent.initialize_contracts(contract_config)
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())

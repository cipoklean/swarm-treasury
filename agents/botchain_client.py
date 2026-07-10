#!/usr/bin/env python3
"""
BOT Chain Client - Thin async wrapper around Web3.py for BOT Chain
Part of Swarm Treasury multi-agent system
"""

import asyncio
import json
import logging
import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

import web3
from web3 import Web3, HTTPProvider
from web3.contract import Contract
from web3.middleware import ExtraDataToPOAMiddleware
from web3.types import TxReceipt, HexBytes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","message":"%(message)s","module":"botchain_client"}'
)
logger = logging.getLogger(__name__)


@dataclass
class ChainConfig:
    """BOT Chain configuration"""
    rpc_url: str
    chain_id: int
    block_time: float = 0.75  # seconds
    

@dataclass  
class ContractConfig:
    """Contract configuration"""
    address: str
    abi: Dict[str, Any]


class BotChainClient:
    """
    Async BOT Chain client with event polling and transaction support
    """
    
    def __init__(self, rpc_url: str, chain_id: int = 968):
        """
        Initialize BOT Chain client
        
        Args:
            rpc_url: BOT Chain RPC URL
            chain_id: Chain ID (968 for BOT Chain — matches config.json / chainConfig.ts)
        """
        self.rpc_url = rpc_url
        self.chain_id = chain_id
        self.w3 = Web3(HTTPProvider(rpc_url))
        
        # Add POA middleware if needed
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        
        # Contract caches
        self._contracts: Dict[str, Contract] = {}
        self._last_block: int = 0
        self._block_time: float = 0.75
        
        # Event filters
        self._event_filters: Dict[str, Any] = {}
        
        logger.info(f"Initialized BOT Chain client for chain {chain_id}")
        logger.info(f"RPC URL: {rpc_url}")
        logger.info(f"Connected: {self.is_connected()}")
    
    def is_connected(self) -> bool:
        """Check if connected to RPC"""
        try:
            return self.w3.is_connected()
        except Exception:
            return False
    
    async def get_latest_block(self) -> Dict[str, Any]:
        """Get latest block information"""
        try:
            block = self.w3.eth.get_block('latest')
            return {
                'number': block.get('number', getattr(block, 'number', 0)),
                'hash': (block.get('hash', getattr(block, 'hash', b'')) or b'').hex(),
                'timestamp': block.get('timestamp', getattr(block, 'timestamp', 0)),
                'gas_limit': block.get('gasLimit', getattr(block, 'gasLimit', block.get('gas_limit', getattr(block, 'gas_limit', 0)))),
                'gas_used': block.get('gasUsed', getattr(block, 'gasUsed', block.get('gas_used', getattr(block, 'gas_used', 0)))),
                'transactions': len(block.get('transactions', getattr(block, 'transactions', [])) or [])
            }
        except Exception as e:
            logger.error(f"Failed to get latest block: {e}")
            raise
    
    async def get_block_time(self) -> float:
        """Get average block time"""
        return self._block_time
    
    async def poll_blocks(self, callback: callable, interval: float = 0.75) -> None:
        """
        Poll for new blocks continuously
        
        Args:
            callback: Function to call with new block data
            interval: Polling interval in seconds
        """
        last_block = await self.get_latest_block()
        last_block_number = last_block['number']
        
        while True:
            try:
                await asyncio.sleep(interval)
                current_block = await self.get_latest_block()
                current_block_number = current_block['number']
                
                if current_block_number > last_block_number:
                    # New block(s) found
                    for block_num in range(last_block_number + 1, current_block_number + 1):
                        block_data = self.w3.eth.get_block(block_num)
                        callback(block_data)
                    
                    last_block_number = current_block_number
                    
            except Exception as e:
                logger.error(f"Block polling error: {e}")
                await asyncio.sleep(5)  # Wait before retry
    
    def load_contract(self, name: str, address: str, abi: Dict[str, Any]) -> Contract:
        """
        Load a contract by name, address, and ABI
        
        Args:
            name: Contract name for caching
            address: Contract address
            abi: Contract ABI
            
        Returns:
            Web3.py Contract instance
        """
        if name in self._contracts:
            return self._contracts[name]
        
        try:
            contract = self.w3.eth.contract(address=address, abi=abi)
            self._contracts[name] = contract
            logger.info(f"Loaded contract {name} at {address}")
            return contract
        except Exception as e:
            logger.error(f"Failed to load contract {name}: {e}")
            raise
    
    def get_contract(self, name: str) -> Optional[Contract]:
        """Get cached contract by name"""
        return self._contracts.get(name)
    
    async def send_transaction(
        self, 
        contract: Contract, 
        function_name: str, 
        args: List[Any] = None,
        private_key: str = None,
        gas_limit: int = None,
        value: int = 0
    ) -> Dict[str, Any]:
        """
        Send a transaction to a contract
        
        Args:
            contract: Contract instance
            function_name: Function name to call
            args: Function arguments
            private_key: Private key for signing
            gas_limit: Gas limit
            value: Value in wei
            
        Returns:
            Transaction receipt
        """
        if args is None:
            args = []
        
        try:
            # Get function
            func = contract.get_function_by_name(function_name)
            
            # Build transaction
            tx = func(*args).build_transaction({
                'from': self.w3.eth.account.from_key(private_key).address,
                'gas': gas_limit or 2000000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(
                    self.w3.eth.account.from_key(private_key).address
                ),
                'value': value,
                'chainId': self.chain_id
            })
            
            # Sign transaction
            signed_tx = self.w3.eth.account.sign_transaction(tx, private_key)
            
            # Send transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            
            # Wait for receipt
            receipt_raw = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            receipt = dict(receipt_raw)
            
            logger.info(f"Transaction sent: {tx_hash.hex()}")
            logger.info(f"Gas used: {receipt.get('gasUsed', receipt.get('gas_used', 0))}")
            
            return {
                'tx_hash': tx_hash.hex(),
                'receipt': receipt,
                'block_number': receipt.get('blockNumber', receipt.get('block_number', 0)),
                'block_hash': (receipt.get('blockHash') or receipt.get('block_hash') or b'').hex(),
                'gas_used': receipt.get('gasUsed', receipt.get('gas_used', 0))
            }
            
        except Exception as e:
            logger.error(f"Transaction failed: {e}")
            raise
    
    async def get_events(
        self, 
        contract: Contract, 
        event_name: str, 
        from_block: int = 0, 
        to_block: str = 'latest'
    ) -> List[Dict[str, Any]]:
        """
        Get contract events
        
        Args:
            contract: Contract instance
            event_name: Event name
            from_block: Starting block
            to_block: Ending block
            
        Returns:
            List of event logs
        """
        try:
            event_filter = contract.events[event_name].create_filter(
                from_block=from_block,
                to_block=to_block
            )
            
            logs = event_filter.get_all_entries()
            return [dict(log) for log in logs]
            
        except Exception as e:
            logger.error(f"Failed to get events {event_name}: {e}")
            return []
    
    async def subscribe_to_events(
        self, 
        contract: Contract, 
        event_name: str, 
        callback: callable
    ) -> str:
        """
        Subscribe to contract events
        
        Args:
            contract: Contract instance
            event_name: Event name
            callback: Function to call with event data
            
        Returns:
            Filter ID
        """
        try:
            event_filter = contract.events[event_name].create_filter()
            filter_id = str(event_filter.filter_id)
            
            def event_callback(event):
                callback(dict(event))
            
            self._event_filters[filter_id] = {
                'filter': event_filter,
                'callback': event_callback
            }
            
            logger.info(f"Subscribed to event {event_name} with filter {filter_id}")
            return filter_id
            
        except Exception as e:
            logger.error(f"Failed to subscribe to events {event_name}: {e}")
            raise
    
    def unsubscribe_from_events(self, filter_id: str) -> None:
        """Unsubscribe from events"""
        if filter_id in self._event_filters:
            filter_data = self._event_filters[filter_id]
            filter_data['filter'].uninstall()
            del self._event_filters[filter_id]
            logger.info(f"Unsubscribed from filter {filter_id}")
    
    async def get_balance(self, address: str, token_address: str = None) -> int:
        """
        Get balance of an address
        
        Args:
            address: Address to check balance
            token_address: Token contract address (None for native token)
            
        Returns:
            Balance in wei
        """
        try:
            if token_address:
                # ERC20 token balance
                token_contract = self.w3.eth.contract(
                    address=token_address, 
                    abi=[
                        {
                            'constant': True,
                            'inputs': [{'name': '_owner', 'type': 'address'}],
                            'name': 'balanceOf',
                            'outputs': [{'name': 'balance', 'type': 'uint256'}],
                            'type': 'function'
                        }
                    ]
                )
                return token_contract.functions.balanceOf(address).call()
            else:
                # Native token balance
                return self.w3.eth.get_balance(address)
                
        except Exception as e:
            logger.error(f"Failed to get balance for {address}: {e}")
            raise


# Singleton instance
_botchain_client: Optional[BotChainClient] = None


def get_botchain_client() -> BotChainClient:
    """Get or create singleton BotChain client"""
    global _botchain_client
    
    if _botchain_client is None:
        rpc_url = os.getenv('BOT_CHAIN_RPC_URL', 'https://bot-chain-rpc.url')
        chain_id = int(os.getenv('BOT_CHAIN_ID', '968'))
        _botchain_client = BotChainClient(rpc_url, chain_id)
    
    return _botchain_client


async def main():
    """Test main function"""
    client = get_botchain_client()
    
    # Test connection
    print(f"Connected: {client.is_connected()}")
    
    # Get latest block
    block = await client.get_latest_block()
    print(f"Latest block: {block}")


if __name__ == "__main__":
    asyncio.run(main())

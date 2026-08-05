#!/usr/bin/env python3
"""Deposit tokens into the TreasuryVault internal accounting.

Usage:
    python3 deposit_to_vault.py 0xYOUR_DEPLOYER_KEY
"""
import sys
from web3 import Web3

RPC = "https://rpc.bohr.life"
VAULT = "0x3a7282ffb230742ed31cfeda0ed6cde5a34d1dee"
TOKEN = "0xae7722Bc560Dc4D625cBF30F154faf3E3fa13852"
AMOUNT = 100_000 * 10**18  # 100k sUSD

VAULT_ABI = [
    {
        "inputs": [
            {"name": "asset", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "deposit",
        "outputs": [],
        "type": "function",
    }
]
ERC20_ABI = [
    {"inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "type": "function", "constant": False},
    {"inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "type": "function", "constant": True},
    {"inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}], "name": "mint", "outputs": [{"name": "", "type": "bool"}], "type": "function", "constant": False},
    {"inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function", "constant": True},
]


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 deposit_to_vault.py <DEPLOYER_PRIVATE_KEY>")
        sys.exit(1)

    deployer_key = sys.argv[1]
    w3 = Web3(Web3.HTTPProvider(RPC))
    acct = w3.eth.account.from_key(deployer_key)

    token = w3.eth.contract(address=w3.to_checksum_address(TOKEN), abi=ERC20_ABI)
    vault = w3.eth.contract(address=w3.to_checksum_address(VAULT), abi=VAULT_ABI)

    print(f"Deployer: {acct.address}")
    print(f"Sending 100,000 sUSD to vault (internal deposit)")

    # Ensure we're funded
    bal = token.functions.balanceOf(acct.address).call()
    print(f"Token balance: {bal / 10**18:,.2f} sUSD")
    if bal < AMOUNT:
        print("Minting 100k sUSD to self...")
        nonce = w3.eth.get_transaction_count(acct.address, "pending")
        tx = token.functions.mint(acct.address, AMOUNT).build_transaction({
            "from": acct.address, "nonce": nonce, "gas": 100_000, "gasPrice": w3.eth.gas_price,
        })
        signed = acct.sign_transaction(tx)
        h = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(h)
        print(f"Minted ✓ ({h.hex()})")

    # Approve vault if needed
    allowance = token.functions.allowance(acct.address, w3.to_checksum_address(VAULT)).call()
    if allowance < AMOUNT:
        print("Approving vault to spend...")
        nonce = w3.eth.get_transaction_count(acct.address, "pending")
        tx = token.functions.approve(w3.to_checksum_address(VAULT), AMOUNT).build_transaction({
            "from": acct.address, "nonce": nonce, "gas": 100_000, "gasPrice": w3.eth.gas_price,
        })
        signed = acct.sign_transaction(tx)
        h = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(h)
        print(f"Approved ✓ ({h.hex()})")
    else:
        print(f"Already approved (allowance: {allowance / 10**18:,.2f})")

    # Deposit into vault (this increments treasuryBalance!)
    nonce = w3.eth.get_transaction_count(acct.address, "pending")
    tx = vault.functions.deposit(w3.to_checksum_address(TOKEN), AMOUNT).build_transaction({
        "from": acct.address, "nonce": nonce, "gas": 200_000, "gasPrice": w3.eth.gas_price,
    })
    signed = acct.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Depositing — tx: {h.hex()}")
    r = w3.eth.wait_for_transaction_receipt(h)
    print(f"✓ Confirmed in block {r.blockNumber} — vault funded!")


if __name__ == "__main__":
    main()

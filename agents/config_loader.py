#!/usr/bin/env python3
"""
Shared config loading for Swarm Treasury agents.
Loads .env (if present), config.json, and provides typed accessors.
"""

import json
import os
from typing import Dict, Any

def load_config() -> Dict[str, Any]:
    """Load config.json from the project root (parent of agents/).

    Respects SWARM_USE_MAINNET=true to switch to the mainnet contract block
    (config["contracts_mainnet"]). When unset/false, uses config["contracts"]
    (testnet / rialto by default).
    """
    config_path = os.environ.get(
        "SWARM_CONFIG_PATH",
        os.path.join(os.path.dirname(__file__), "..", "config.json"),
    )
    with open(config_path) as f:
        cfg = json.load(f)
    use_mainnet = os.environ.get("SWARM_USE_MAINNET", "").lower() in ("1", "true", "yes")
    if use_mainnet and "contracts_mainnet" in cfg:
        contracts = dict(cfg.get("contracts", {}), **cfg["contracts_mainnet"])
    else:
        contracts = cfg.get("contracts", {})
    return cfg, contracts


def load_env():
    """Load .env file from project root if python-dotenv is available."""
    try:
        from dotenv import load_dotenv
        dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        load_dotenv(dotenv_path)
    except ImportError:
        pass  # python-dotenv not installed; user must source env themselves


def get_contracts_config(contracts: Dict[str, Any], abis: Dict[str, Any]) -> Dict[str, Any]:
    """Extract contract-specific config from the contracts block + abis."""
    return {
        "treasury_vault_address": contracts["treasury_vault_address"],
        "treasury_vault_abi": abis["treasury_vault_abi"],
        "agent_registry_address": contracts["agent_registry_address"],
        "agent_registry_abi": abis["agent_registry_abi"],
        "message_bus_address": contracts["message_bus_address"],
        "message_bus_abi": abis["message_bus_abi"],
        "governor_address": contracts["governor_address"],
        "governor_abi": abis["governor_abi"],
    }

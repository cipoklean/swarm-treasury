// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TreasuryVault} from "../contracts/TreasuryVault.sol";
import {AgentRegistry} from "../contracts/AgentRegistry.sol";
import {MessageBus} from "../contracts/MessageBus.sol";
import {Governor} from "../contracts/Governor.sol";
import {MockYieldStrategy} from "../contracts/YieldStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DeploySwarmTreasury
/// @notice Deploys all Swarm Treasury contracts and assigns agent roles
/// @dev Reads private keys from .env and derives addresses automatically
contract DeploySwarmTreasury is Script {
    AgentRegistry public registry;
    MessageBus public messageBus;
    TreasuryVault public vault;
    Governor public governor;
    ERC20 public mockToken;
    MockYieldStrategy public mockStrategy;

    function run() external {
        // Derive agent addresses from private keys
        uint256 deployerPK    = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 yieldScoutPK  = vm.envUint("YIELD_SCOUT_PRIVATE_KEY");
        uint256 riskGuardPK   = vm.envUint("RISK_GUARD_PRIVATE_KEY");
        uint256 executorPK    = vm.envUint("EXECUTOR_PRIVATE_KEY");
        uint256 governorPK    = vm.envUint("GOVERNOR_PRIVATE_KEY");

        address governorAddr  = vm.addr(governorPK);
        address yieldScoutAddr = vm.addr(yieldScoutPK);
        address riskGuardAddr  = vm.addr(riskGuardPK);
        address executorAddr   = vm.addr(executorPK);

        console.log("Deployer:       ", vm.addr(deployerPK));
        console.log("Governor:       ", governorAddr);
        console.log("Yield Scout:    ", yieldScoutAddr);
        console.log("Risk Guard:     ", riskGuardAddr);
        console.log("Executor:       ", executorAddr);
        console.log("");

        vm.startBroadcast(deployerPK);

        // 1. AgentRegistry — deployer is initial admin, then grant GOVERNOR_ROLE to governor
        registry = new AgentRegistry();
        registry.initialize(vm.addr(deployerPK));
        registry.grantRole(keccak256("GOVERNOR_ROLE"), governorAddr);
        console.log("AgentRegistry:", address(registry));

        // 2. MessageBus
        messageBus = new MessageBus();
        messageBus.initialize();
        console.log("MessageBus:", address(messageBus));

        // 3. TreasuryVault
        vault = new TreasuryVault();
        vault.initialize(governorAddr, governorAddr, address(registry), address(messageBus));
        console.log("TreasuryVault:", address(vault));

        // 4. Governor
        governor = new Governor();
        governor.initialize(address(vault), address(registry), address(messageBus));
        console.log("Governor:", address(governor));

        // 5. Mock token & strategy
        mockToken = new ERC20("Swarm USD", "sUSD");
        console.log("MockToken:", address(mockToken));

        mockStrategy = new MockYieldStrategy();
        console.log("MockStrategy:", address(mockStrategy));

        // 6. Grant roles on vault
        bytes32 YIELD_SCOUT_ROLE = keccak256("YIELD_SCOUT_ROLE");
        bytes32 RISK_GUARD_ROLE  = keccak256("RISK_GUARD_ROLE");
        bytes32 EXECUTOR_ROLE   = keccak256("EXECUTOR_ROLE");

        vault.grantRole(YIELD_SCOUT_ROLE, yieldScoutAddr);
        vault.grantRole(RISK_GUARD_ROLE,  riskGuardAddr);
        vault.grantRole(EXECUTOR_ROLE,    executorAddr);

        // 7. Whitelist token
        vault.addAssetToWhitelist(address(mockToken), 1_000_000 ether, 1000);

        // 8. Add strategy
        vault.addStrategy(address(mockStrategy), address(mockToken), 100_000 ether, 500, 30);

        // 9. Register agents
        registry.registerAgent(yieldScoutAddr, 1);
        registry.registerAgent(riskGuardAddr,  2);
        registry.registerAgent(executorAddr,   3);

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("AgentRegistry:", address(registry));
        console.log("MessageBus:   ", address(messageBus));
        console.log("TreasuryVault:", address(vault));
        console.log("Governor:     ", address(governor));
        console.log("MockToken:    ", address(mockToken));
        console.log("MockStrategy: ", address(mockStrategy));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TreasuryVault} from "../contracts/TreasuryVault.sol";
import {AgentRegistry} from "../contracts/AgentRegistry.sol";
import {MessageBus} from "../contracts/MessageBus.sol";
import {Governor} from "../contracts/Governor.sol";
import {MockYieldStrategy} from "../contracts/YieldStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MintableERC20} from "../contracts/MintableERC20.sol";

/// @title DeploySwarmTreasury
/// @notice Deploys all Swarm Treasury contracts and assigns agent roles
/// @dev Reads private keys from .env and derives addresses automatically
contract DeploySwarmTreasury is Script {
    AgentRegistry public registry;
    MessageBus public messageBus;
    TreasuryVault public vault;
    Governor public governor;
    MintableERC20 public mockToken;
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
        address deployerAddr   = vm.addr(deployerPK);

        console.log("Deployer:       ", vm.addr(deployerPK));
        console.log("Governor:       ", governorAddr);
        console.log("Yield Scout:    ", yieldScoutAddr);
        console.log("Risk Guard:     ", riskGuardAddr);
        console.log("Executor:       ", executorAddr);
        console.log("");

        vm.startBroadcast(deployerPK);

        // 1. AgentRegistry — deployer is initial admin, then grant GOVERNOR_ROLE to governor
        registry = new AgentRegistry();
        registry.initialize(deployerAddr);
        registry.grantRole(keccak256("GOVERNOR_ROLE"), governorAddr);
        registry.grantRole(keccak256("GOVERNOR_ROLE"), deployerAddr); // deployer registers agents during deploy (revoked at end)
        console.log("AgentRegistry:", address(registry));

        // 2. MessageBus
        messageBus = new MessageBus();
        messageBus.initialize();
        messageBus.setAgentRegistry(address(registry));
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
        mockToken = new MintableERC20("Swarm USD", "sUSD");
        console.log("MockToken:", address(mockToken));
        console.log("Token supply (deployer):", mockToken.balanceOf(deployerAddr));

        mockStrategy = new MockYieldStrategy();
        console.log("MockStrategy:", address(mockStrategy));

        // 6. Grant roles on vault
        bytes32 YIELD_SCOUT_ROLE = keccak256("YIELD_SCOUT_ROLE");
        bytes32 RISK_GUARD_ROLE  = keccak256("RISK_GUARD_ROLE");
        bytes32 EXECUTOR_ROLE   = keccak256("EXECUTOR_ROLE");

        vault.grantRole(YIELD_SCOUT_ROLE, yieldScoutAddr);
        vault.grantRole(RISK_GUARD_ROLE,  riskGuardAddr);
        vault.grantRole(EXECUTOR_ROLE,    executorAddr);

        // Governor contract (and its agent key) must be able to pause/withdraw via the vault
        vault.grantRole(keccak256("GOVERNOR_ROLE"), address(governor));
        vault.grantRole(keccak256("GOVERNOR_ROLE"), governorAddr);

        // Wire the Governor contract so withdraw() consults its largeMoveThreshold.
        // Without this, TreasuryVault.withdraw falls back to the hardcoded
        // LARGE_MOVE_THRESHOLD_BPS and the Governor's on-chain threshold is never read.
        vault.setGovernorContract(address(governor));

        // 7. Whitelist token
        vault.addAssetToWhitelist(address(mockToken), 1_000_000 ether, 1000);

        // 8. Add strategy
        vault.addStrategy(address(mockStrategy), address(mockToken), 100_000 ether, 500, 30);

        // Register agents as deployer (deployer was granted GOVERNOR_ROLE above; only the deployer key is needed for broadcast)
        registry.registerAgent(yieldScoutAddr, 1);
        registry.registerAgent(riskGuardAddr, 2);
        registry.registerAgent(executorAddr, 3);
        registry.registerAgent(governorAddr, 4); // governor agent must be registered for approveProposal/postMessage

        // 9. Security hardening for mainnet: the deployer was temporarily granted
        //    GOVERNOR_ROLE on the vault + registry to perform setup. Revoke it now so
        //    only the Governor contract + Governor key retain god-mode. Skipping this
        //    leaves a hot deployer key with full control of the treasury.
        vault.revokeRole(keccak256("GOVERNOR_ROLE"), deployerAddr);
        registry.revokeRole(keccak256("GOVERNOR_ROLE"), deployerAddr);

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

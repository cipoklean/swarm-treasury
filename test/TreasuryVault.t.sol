// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {TreasuryVault} from "../contracts/TreasuryVault.sol";
import {ITreasury} from "../contracts/ITreasury.sol";
import {AgentRegistry} from "../contracts/AgentRegistry.sol";
import {MessageBus} from "../contracts/MessageBus.sol";
import {MockYieldStrategy} from "../contracts/YieldStrategy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TreasuryVaultTest is Test {
    TreasuryVault public vault;
    AgentRegistry public registry;
    MessageBus public bus;
    MockYieldStrategy public strategy;
    ERC20 public token;

    address public governor = makeAddr("governor");
    address public yieldScout = makeAddr("yieldScout");
    address public riskGuard = makeAddr("riskGuard");
    address public executor = makeAddr("executor");
    address public treasurer = makeAddr("treasurer");
    address public guardian = makeAddr("guardian");
    address public stranger = makeAddr("stranger");

    bytes32 constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 constant YIELD_SCOUT_ROLE = keccak256("YIELD_SCOUT_ROLE");
    bytes32 constant RISK_GUARD_ROLE = keccak256("RISK_GUARD_ROLE");
    bytes32 constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    uint256 constant INITIAL_BALANCE = 1_000_000 ether;

    function setUp() public {
        // Deploy token
        token = new ERC20("Mock Token", "MTK");

        // Deploy registry and register agents
        registry = new AgentRegistry();
        registry.initialize(governor);
        vm.prank(governor);
        registry.registerAgent(yieldScout, 1);
        vm.prank(governor);
        registry.registerAgent(riskGuard, 2);
        vm.prank(governor);
        registry.registerAgent(executor, 3);

        // Deploy message bus
        bus = new MessageBus();
        bus.initialize();

        // Deploy strategy (NOT initialized — vault initializes it via addStrategy)
        strategy = new MockYieldStrategy();

        // Deploy vault
        vault = new TreasuryVault();
        vault.initialize(treasurer, guardian, address(registry), address(bus));

        // Register executor executor role in vault
        vm.prank(address(this)); // deployer has GOVERNOR_ROLE
        vault.grantRole(EXECUTOR_ROLE, executor);

        // Grant YIELD_SCOUT_ROLE to yieldScout on the vault
        vm.prank(address(this));
        vault.grantRole(YIELD_SCOUT_ROLE, yieldScout);

        // Grant RISK_GUARD_ROLE to riskGuard on the vault
        vm.prank(address(this));
        vault.grantRole(RISK_GUARD_ROLE, riskGuard);

        // Whitelist token
        vm.prank(address(this));
        vault.addAssetToWhitelist(address(token), 1_000_000 ether, 1000);

        // Fund users
        deal(address(token), yieldScout, INITIAL_BALANCE);
        deal(address(token), riskGuard, INITIAL_BALANCE);
        deal(address(token), executor, INITIAL_BALANCE);
        deal(address(token), treasurer, INITIAL_BALANCE);
        deal(address(token), guardian, INITIAL_BALANCE);
        deal(address(token), stranger, INITIAL_BALANCE);
    }

    // ==================== initialize ====================

    function test_Initialize() public {
        assertTrue(vault.hasRole(GOVERNOR_ROLE, address(this)));
        assertEq(vault.treasurer(), treasurer);
        assertEq(vault.guardian(), guardian);
    }

    // ==================== deposit ====================

    function test_Deposit() public {
        uint256 amount = 10_000 ether;

        vm.startPrank(treasurer);
        token.approve(address(vault), amount);
        vault.deposit(address(token), amount);
        vm.stopPrank();

        assertEq(vault.treasuryBalance(address(token)), amount);
        assertEq(token.balanceOf(address(vault)), amount);
    }

    function test_Deposit_RevertNotWhitelisted() public {
        address fakeAsset = makeAddr("fake");
        vm.prank(treasurer);
        vm.expectRevert("Asset not whitelisted");
        vault.deposit(fakeAsset, 100);
    }

    function test_Deposit_RevertZero() public {
        vm.prank(treasurer);
        vm.expectRevert("Amount must be > 0");
        vault.deposit(address(token), 0);
    }

    // ==================== createProposal ====================

    function test_CreateProposal() public {
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, "", "test proposal");

        assertEq(vault.proposalCount(), 1);
    }

    function test_CreateProposal_RevertNotYieldScout() public {
        vm.prank(stranger);
        // AccessControl will revert (not YIELD_SCOUT_ROLE)
        vm.expectRevert();
        vault.createProposal(address(token), 0, "", "test");
    }

    // ==================== approveProposal ====================

    function test_ApproveProposal_RiskGuard() public {
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, "", "test");

        vm.prank(riskGuard);
        vault.approveProposal(1);
        // No revert = success, proposal exists
        assertEq(vault.proposalCount(), 1);
    }

    // ==================== vetoProposal ====================

    function test_VetoProposal() public {
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, "", "test");

        vm.prank(riskGuard);
        vault.vetoProposal(1, "too risky");

        (, , , , , , , , bool cancelled) = vault.proposals(1);
        assertTrue(cancelled);
    }

    function test_VetoProposal_RevertNotRiskGuard() public {
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, "", "test");

        vm.prank(stranger);
        vm.expectRevert();
        vault.vetoProposal(1, "nope");
    }

    // ==================== vote ====================

    function test_Vote() public {
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, "", "test");

        // Voting starts at deadline - votingPeriod = (1+1+10) - 10 = block 2
        vm.roll(2);

        vm.prank(yieldScout);
        vault.vote(1, true);

        (, , , , , uint256 forVotes, , , ) = vault.proposals(1);
        assertEq(forVotes, 1);
    }

    // ==================== executeProposal ====================

    function test_ExecuteProposal() public {
        // External-target proposal (token.balanceOf) executed by the EXECUTOR role
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, abi.encodeWithSignature("balanceOf(address)", address(vault)), "test");

        vm.roll(2);
        vm.prank(riskGuard);
        vault.approveProposal(1);

        vm.roll(20);
        vm.prank(executor);
        vault.executeProposal(1);

        (, , , , , , , bool executed, ) = vault.proposals(1);
        assertTrue(executed);
    }

    function test_ExecuteProposal_RevertNotExecutor() public {
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, abi.encodeWithSignature("balanceOf(address)", address(vault)), "test");
        vm.roll(2);
        vm.prank(riskGuard);
        vault.approveProposal(1);
        vm.roll(20);
        vm.prank(stranger);
        vm.expectRevert(); // onlyRole(EXECUTOR_ROLE)
        vault.executeProposal(1);
    }

    function test_ExecuteProposal_RevertUnsupportedVaultAction() public {
        // Self-targeted proposal with a selector that is NOT depositToStrategy/withdrawFromStrategy
        bytes memory data = abi.encodeWithSelector(vault.pause.selector);
        vm.prank(yieldScout);
        vault.createProposal(address(vault), 0, data, "pause attempt");
        vm.roll(2);
        vm.prank(riskGuard);
        vault.approveProposal(1);
        vm.roll(20);
        vm.prank(executor);
        vm.expectRevert("Unsupported vault action");
        vault.executeProposal(1);
    }

    // ==================== add strategy ====================

    function test_AddStrategy() public {
        // Need to fund strategy with tokens so deposit works
        deal(address(token), address(strategy), 1000 ether);

        vm.prank(address(this)); // governor
        vault.addStrategy(address(strategy), address(token), 10_000 ether, 500, 30);

        assertEq(vault.strategyCount(), 1);
        assertEq(vault.strategies(0), address(strategy));
    }

    // ==================== depositToStrategy ====================

    function test_DepositToStrategy() public {
        // Fund vault + strategy
        deal(address(token), address(strategy), 1000 ether);
        vm.prank(address(this));
        vault.addStrategy(address(strategy), address(token), 10_000 ether, 500, 30);

        // Deposit to vault
        vm.startPrank(treasurer);
        token.approve(address(vault), 5000 ether);
        vault.deposit(address(token), 5000 ether);
        vm.stopPrank();

        // Yield Scout proposes a depositToStrategy action targeting the vault itself
        bytes memory data = abi.encodeWithSelector(vault.depositToStrategy.selector, address(strategy), 1000 ether);
        vm.prank(yieldScout);
        vault.createProposal(address(vault), 0, data, "deposit to strategy");

        vm.roll(2);
        vm.prank(riskGuard);
        vault.approveProposal(1);

        vm.roll(20);
        vm.prank(executor);
        vault.executeProposal(1);

        // Check strategy allocation moved on-chain
        (, , uint256 currentAllocation, , , ) = vault.strategyConfig(address(strategy));
        assertEq(currentAllocation, 1000 ether);
    }

    // ==================== withdrawFromStrategy ====================

    function test_WithdrawFromStrategy() public {
        deal(address(token), address(strategy), 1000 ether);
        vm.prank(address(this));
        vault.addStrategy(address(strategy), address(token), 10_000 ether, 500, 30);

        vm.startPrank(treasurer);
        token.approve(address(vault), 5000 ether);
        vault.deposit(address(token), 5000 ether);
        vm.stopPrank();

        // Deposit into strategy via proposal
        bytes memory data = abi.encodeWithSelector(vault.depositToStrategy.selector, address(strategy), 1000 ether);
        vm.prank(yieldScout);
        vault.createProposal(address(vault), 0, data, "deposit");
        vm.roll(2);
        vm.prank(riskGuard);
        vault.approveProposal(1);
        vm.roll(20);
        vm.prank(executor);
        vault.executeProposal(1);

        // Withdraw from strategy via proposal
        bytes memory wdata = abi.encodeWithSelector(vault.withdrawFromStrategy.selector, address(strategy), 500 ether);
        vm.prank(yieldScout);
        vault.createProposal(address(vault), 0, wdata, "withdraw");
        vm.roll(22);
        vm.prank(riskGuard);
        vault.approveProposal(2);
        vm.roll(40);
        vm.prank(executor);
        vault.executeProposal(2);

        (, , uint256 currentAllocation, , , ) = vault.strategyConfig(address(strategy));
        assertEq(currentAllocation, 500 ether);
    }

    // ==================== harvestStrategy ====================

    function test_HarvestStrategy() public {
        deal(address(token), address(strategy), 1000 ether);
        vm.prank(address(this));
        vault.addStrategy(address(strategy), address(token), 10_000 ether, 500, 30);

        vm.startPrank(treasurer);
        token.approve(address(vault), 5000 ether);
        vault.deposit(address(token), 5000 ether);
        vm.stopPrank();

        // Move funds into the strategy via a proposal (depositToStrategy is now gated)
        bytes memory data = abi.encodeWithSelector(vault.depositToStrategy.selector, address(strategy), 1000 ether);
        vm.prank(yieldScout);
        vault.createProposal(address(vault), 0, data, "deposit");
        vm.roll(2);
        vm.prank(riskGuard);
        vault.approveProposal(1);
        vm.roll(20);
        vm.prank(executor);
        vault.executeProposal(1);

        // Harvest directly (onlyRole EXECUTOR_ROLE)
        vm.prank(executor);
        vault.harvestStrategy(address(strategy));

        // StrategyMetrics
        (, uint256 yield, , ) = vault.strategyMetrics(address(strategy));
        assertGt(yield, 0);
    }

    // ==================== emergencyWithdraw ====================

    function test_EmergencyWithdraw() public {
        vm.startPrank(treasurer);
        token.approve(address(vault), 1000 ether);
        vault.deposit(address(token), 1000 ether);
        vm.stopPrank();

        uint256 preBalance = token.balanceOf(treasurer);

        vm.prank(address(this));
        vault.emergencyWithdraw(address(token), 500 ether, treasurer);

        assertEq(vault.treasuryBalance(address(token)), 500 ether);
        assertEq(token.balanceOf(treasurer), preBalance + 500 ether);
    }

    // ==================== pause / unpause ====================

    function test_PauseUnpause() public {
        vm.prank(address(this));
        vault.pause();

        // Deposit should revert when paused
        vm.prank(treasurer);
        token.approve(address(vault), 100 ether);
        vm.expectRevert();
        vm.prank(treasurer);
        vault.deposit(address(token), 100 ether);

        vm.prank(address(this));
        vault.unpause();

        // Now deposit works
        vm.startPrank(treasurer);
        vault.deposit(address(token), 100 ether);
        vm.stopPrank();
        assertEq(vault.treasuryBalance(address(token)), 100 ether);
    }

    // ==================== access control ====================

    function test_RevertDepositToStrategy_NotExecutor() public {
        deal(address(token), address(strategy), 1000 ether);
        vm.prank(address(this));
        vault.addStrategy(address(strategy), address(token), 10_000 ether, 500, 30);

        vm.prank(stranger);
        vm.expectRevert();
        vault.depositToStrategy(address(strategy), 1000 ether);
    }

    // ==================== getters ====================

    function test_WhitelistedAssetsLength() public {
        assertEq(vault.whitelistedAssetsLength(), 1);
    }

    function test_StrategyCount_Zero() public {
        assertEq(vault.strategyCount(), 0);
    }

    function test_ProposalsGetter() public {
        vm.prank(yieldScout);
        vault.createProposal(address(token), 0, "", "test");

        (address proposer, , , , , , , bool executed, bool cancelled) = vault.proposals(1);
        assertEq(proposer, yieldScout);
        assertEq(executed, false);
        assertEq(cancelled, false);
    }

    // ==================== withdraw (governor-gated) ====================

    function test_Withdraw_RevertNotGovernor() public {
        vm.prank(stranger);
        vm.expectRevert(); // onlyRole(GOVERNOR_ROLE)
        vault.withdraw(address(token), 100 ether, stranger, 2);
    }

    function test_Withdraw_AsGovernor() public {
        vm.startPrank(treasurer);
        token.approve(address(vault), 1000 ether);
        vault.deposit(address(token), 1000 ether);
        vm.stopPrank();

        uint256 pre = token.balanceOf(stranger);
        vm.prank(address(this)); // deployer holds GOVERNOR_ROLE
        vault.withdraw(address(token), 100 ether, stranger, 2);

        assertEq(token.balanceOf(stranger), pre + 100 ether);
        assertEq(vault.treasuryBalance(address(token)), 900 ether);
    }

    // ==================== remove strategy ====================
}

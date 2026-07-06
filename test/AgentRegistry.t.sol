// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {AgentRegistry} from "../contracts/AgentRegistry.sol";
import {IAgentRegistry} from "../contracts/IAgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;

    address public governor = makeAddr("governor");
    address public scout = makeAddr("scout");
    address public riskGuard = makeAddr("riskGuard");
    address public executor = makeAddr("executor");
    address public stranger = makeAddr("stranger");

    bytes32 constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 constant YIELD_SCOUT_ROLE = keccak256("YIELD_SCOUT_ROLE");
    bytes32 constant RISK_GUARD_ROLE = keccak256("RISK_GUARD_ROLE");
    bytes32 constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    uint8 constant ROLE_YIELD_SCOUT = 1;
    uint8 constant ROLE_RISK_GUARD = 2;
    uint8 constant ROLE_EXECUTOR = 3;
    uint8 constant ROLE_GOVERNOR = 4;

    function setUp() public {
        registry = new AgentRegistry();
        registry.initialize(governor);
    }

    // ==================== initialize ====================

    function test_Initialize() public {
        assertEq(registry.getAgentRole(governor), 0); // governor not registered as agent
        assertTrue(registry.hasRole(GOVERNOR_ROLE, governor));
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), governor));
    }

    function test_CannotReinitialize() public {
        vm.expectRevert();
        registry.initialize(governor);
    }

    // ==================== registerAgent ====================

    function test_RegisterAgent_YieldScout() public {
        vm.prank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);

        assertEq(registry.getAgentRole(scout), ROLE_YIELD_SCOUT);
        assertTrue(registry.isAgent(scout));
        assertTrue(registry.hasRole(YIELD_SCOUT_ROLE, scout));
        assertEq(registry.agentCount(), 1);

        address[] memory agents = registry.getAgentsByRole(ROLE_YIELD_SCOUT);
        assertEq(agents.length, 1);
        assertEq(agents[0], scout);
    }

    function test_RegisterAgent_RiskGuard() public {
        vm.prank(governor);
        registry.registerAgent(riskGuard, ROLE_RISK_GUARD);

        assertEq(registry.getAgentRole(riskGuard), ROLE_RISK_GUARD);
        assertTrue(registry.isAgent(riskGuard));
    }

    function test_RegisterAgent_Executor() public {
        vm.prank(governor);
        registry.registerAgent(executor, ROLE_EXECUTOR);

        assertEq(registry.getAgentRole(executor), ROLE_EXECUTOR);
        assertTrue(registry.isAgent(executor));
    }

    function test_RegisterAgent_Governor() public {
        vm.prank(governor);
        registry.registerAgent(stranger, ROLE_GOVERNOR);

        assertEq(registry.getAgentRole(stranger), ROLE_GOVERNOR);
        assertTrue(registry.isAgent(stranger));
    }

    function test_RevertRegister_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert();
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
    }

    function test_RevertRegister_ZeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid agent address");
        registry.registerAgent(address(0), ROLE_YIELD_SCOUT);
    }

    function test_RevertRegister_Duplicate() public {
        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
        vm.expectRevert("Agent already registered");
        registry.registerAgent(scout, ROLE_RISK_GUARD);
        vm.stopPrank();
    }

    function test_RevertRegister_InvalidRole() public {
        vm.prank(governor);
        vm.expectRevert("Invalid role");
        registry.registerAgent(scout, 5);
    }

    // ==================== unregisterAgent ====================

    function test_UnregisterAgent() public {
        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
        registry.unregisterAgent(scout);

        assertEq(registry.getAgentRole(scout), 0);
        assertFalse(registry.isAgent(scout));
        assertEq(registry.agentCount(), 0);
        vm.stopPrank();
    }

    function test_RevertUnregister_NotAuthorized() public {
        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert();
        registry.unregisterAgent(scout);
    }

    function test_RevertUnregister_NotRegistered() public {
        vm.prank(governor);
        vm.expectRevert("Agent not registered");
        registry.unregisterAgent(scout);
    }

    // ==================== updateAgentRole ====================

    function test_UpdateAgentRole() public {
        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);

        registry.updateAgentRole(scout, ROLE_EXECUTOR);

        assertEq(registry.getAgentRole(scout), ROLE_EXECUTOR);
        assertTrue(registry.hasRole(EXECUTOR_ROLE, scout));
        // old role should be revoked
        assertFalse(registry.hasRole(YIELD_SCOUT_ROLE, scout));
        vm.stopPrank();
    }

    function test_RevertUpdateRole_NotAuthorized() public {
        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert();
        registry.updateAgentRole(scout, ROLE_EXECUTOR);
    }

    function test_RevertUpdateRole_SameRole() public {
        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
        vm.expectRevert("Same role");
        registry.updateAgentRole(scout, ROLE_YIELD_SCOUT);
        vm.stopPrank();
    }

    function test_RevertUpdateRole_NotRegistered() public {
        vm.prank(governor);
        vm.expectRevert("Agent not registered");
        registry.updateAgentRole(scout, ROLE_EXECUTOR);
    }

    // ==================== Multiple agents ====================

    function test_MultipleAgentsPerRole() public {
        address scout2 = makeAddr("scout2");
        address scout3 = makeAddr("scout3");

        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
        registry.registerAgent(scout2, ROLE_YIELD_SCOUT);
        registry.registerAgent(scout3, ROLE_YIELD_SCOUT);
        vm.stopPrank();

        address[] memory agents = registry.getAgentsByRole(ROLE_YIELD_SCOUT);
        assertEq(agents.length, 3);
        assertEq(registry.agentCount(), 3);
    }

    function test_AgentsByRole_AfterUnregister() public {
        address scout2 = makeAddr("scout2");

        vm.startPrank(governor);
        registry.registerAgent(scout, ROLE_YIELD_SCOUT);
        registry.registerAgent(scout2, ROLE_YIELD_SCOUT);
        registry.unregisterAgent(scout);
        vm.stopPrank();

        address[] memory agents = registry.getAgentsByRole(ROLE_YIELD_SCOUT);
        assertEq(agents.length, 1);
        assertEq(agents[0], scout2);
    }

    // ==================== getters ====================

    function test_IsAgent_False() public {
        assertFalse(registry.isAgent(stranger));
    }

    function test_GetAgentRole_Zero() public {
        assertEq(registry.getAgentRole(stranger), 0);
    }

    // ==================== supportsInterface ====================

    function test_SupportsInterface() public {
        assertTrue(registry.supportsInterface(type(IAgentRegistry).interfaceId));
    }
}

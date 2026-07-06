// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Governor} from "../contracts/Governor.sol";
import {IGovernor} from "../contracts/IGovernor.sol";

contract GovernorTest is Test {
    Governor public gov;

    address public governor = makeAddr("governor");
    address public stranger = makeAddr("stranger");
    address public treasury = makeAddr("treasury");
    address public registry = makeAddr("registry");
    address public msgBus = makeAddr("msgBus");

    bytes32 constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    function setUp() public {
        gov = new Governor();
        gov.initialize(treasury, registry, msgBus);
    }

    // ==================== initialize ====================

    function test_Initialize() public {
        assertTrue(gov.hasRole(GOVERNOR_ROLE, address(this)));
        assertEq(address(gov.treasuryVault()), treasury);
        assertEq(address(gov.agentRegistry()), registry);
        assertEq(address(gov.messageBus()), msgBus);
    }

    function test_InitializeDefaultValues() public {
        assertEq(gov.slippageTolerance(), 50);
        assertEq(gov.timelockDuration(), 24);
        assertEq(gov.apyThreshold(), 1000);
        assertEq(gov.largeMoveThreshold(), 2000);
    }

    // ==================== emergencyPause / emergencyUnpause ====================

    function test_EmergencyPause() public {
        vm.prank(address(this)); // deployer has GOVERNOR_ROLE
        gov.emergencyPause();
        assertTrue(gov.isPaused());
    }

    function test_EmergencyUnpause() public {
        vm.startPrank(address(this));
        gov.emergencyPause();
        assertTrue(gov.isPaused());

        gov.emergencyUnpause();
        assertFalse(gov.isPaused());
        vm.stopPrank();
    }

    function test_RevertPause_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert();
        gov.emergencyPause();
    }

    // ==================== parameter setters ====================

    function test_SetSlippageTolerance() public {
        vm.prank(address(this));
        gov.setSlippageTolerance(100);
        assertEq(gov.getSlippageTolerance(), 50); // not applied yet

        // warp past timelock
        vm.roll(block.number + 25);
        gov.applyPendingUpdates();
        assertEq(gov.getSlippageTolerance(), 100);
    }

    function test_RevertSlippage_TooHigh() public {
        vm.prank(address(this));
        vm.expectRevert("Slippage tolerance too high");
        gov.setSlippageTolerance(2000);
    }

    function test_SetTimelockDuration() public {
        vm.prank(address(this));
        gov.setTimelockDuration(48);

        vm.roll(block.number + 25);
        gov.applyPendingUpdates();
        assertEq(gov.getTimelockDuration(), 48);
    }

    function test_RevertTimelock_TooShort() public {
        vm.prank(address(this));
        vm.expectRevert("Timelock duration too short");
        gov.setTimelockDuration(1);
    }

    function test_SetAPYThreshold() public {
        vm.prank(address(this));
        gov.setAPYThreshold(500); // 5%

        vm.roll(block.number + 25);
        gov.applyPendingUpdates();
        assertEq(gov.getAPYThreshold(), 500);
    }

    function test_RevertAPY_TooHigh() public {
        vm.prank(address(this));
        vm.expectRevert("APY threshold too high");
        gov.setAPYThreshold(20000);
    }

    function test_SetLargeMoveThreshold() public {
        vm.prank(address(this));
        gov.setLargeMoveThreshold(3000); // 30%

        vm.roll(block.number + 25);
        gov.applyPendingUpdates();
        assertEq(gov.getLargeMoveThreshold(), 3000);
    }

    function test_RevertLargeMove_TooHigh() public {
        vm.prank(address(this));
        vm.expectRevert("Large move threshold too high");
        gov.setLargeMoveThreshold(6000);
    }

    // ==================== applyPendingUpdates (batch) ====================

    function test_ApplyPendingUpdates_All() public {
        vm.startPrank(address(this));
        gov.setSlippageTolerance(80);
        gov.setAPYThreshold(800);
        vm.stopPrank();

        vm.roll(block.number + 30);
        gov.applyPendingUpdates();

        assertEq(gov.getSlippageTolerance(), 80);
        assertEq(gov.getAPYThreshold(), 800);
        // unchanged
        assertEq(gov.getTimelockDuration(), 24);
        assertEq(gov.getLargeMoveThreshold(), 2000);
    }

    function test_ApplyPendingUpdates_NotYetReady() public {
        vm.prank(address(this));
        gov.setSlippageTolerance(200);

        // no time passed
        gov.applyPendingUpdates();
        assertEq(gov.getSlippageTolerance(), 50); // old value
    }

    // ==================== access control ====================

    function test_RevertParameterSet_NotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert();
        gov.setSlippageTolerance(100);
    }

    // ==================== supportsInterface ====================

    function test_SupportsInterface() public {
        assertTrue(gov.supportsInterface(type(IGovernor).interfaceId));
    }
}

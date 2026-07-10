// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MockYieldStrategy} from "../contracts/YieldStrategy.sol";
import {IYieldStrategy} from "../contracts/IYieldStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract YieldStrategyTest is Test {
    MockYieldStrategy public strategy;
    ERC20 public token;

    address public user = makeAddr("user");
    uint256 constant INITIAL_BALANCE = 100_000 ether;

    function setUp() public {
        token = new ERC20("Mock Token", "MTK");
        strategy = new MockYieldStrategy();
        strategy.initialize(address(token));

        // Fund user
        deal(address(token), user, INITIAL_BALANCE);
        deal(address(token), address(this), INITIAL_BALANCE);
    }

    // ==================== initialize ====================

    function test_Initialize() public {
        assertEq(strategy.getStrategyAsset(), address(token));
        assertEq(strategy.getAPY(), 1200); // 12%
    }

    // ==================== deposit ====================

    function test_Deposit() public {
        uint256 amount = 1000 ether;

        vm.prank(user);
        token.approve(address(strategy), amount);

        vm.prank(user);
        bool success = strategy.deposit(amount);

        assertTrue(success);
        assertEq(strategy.getBalance(), amount);
        assertEq(token.balanceOf(address(strategy)), amount);
    }

    function test_Deposit_RevertZero() public {
        vm.prank(user);
        vm.expectRevert("Amount must be > 0");
        strategy.deposit(0);
    }

    // ==================== withdraw ====================

    function test_Withdraw() public {
        uint256 amount = 1000 ether;

        vm.startPrank(user);
        token.approve(address(strategy), amount);
        strategy.deposit(amount);
        vm.stopPrank();

        // Only the owner (the vault; here the test contract) may withdraw
        uint256 preOwnerBalance = token.balanceOf(address(this));

        bool success = strategy.withdraw(amount);

        assertTrue(success);
        assertEq(strategy.getBalance(), 0);
        assertEq(token.balanceOf(address(this)), preOwnerBalance + amount);
    }

    function test_Withdraw_RevertNotOwner() public {
        uint256 amount = 1000 ether;

        vm.startPrank(user);
        token.approve(address(strategy), amount);
        strategy.deposit(amount);
        vm.stopPrank();

        vm.prank(user);
        vm.expectRevert(); // onlyOwner
        strategy.withdraw(amount);
    }

    function test_Withdraw_RevertZero() public {
        // owner (this contract) may call; zero-amount guard still applies
        vm.expectRevert("Amount must be > 0");
        strategy.withdraw(0);
    }

    function test_Withdraw_RevertInsufficient() public {
        // Called by owner (this contract) but no balance deposited
        vm.expectRevert("Insufficient mock balance");
        strategy.withdraw(100 ether);
    }

    // ==================== harvest ====================

    function test_Harvest() public {
        uint256 amount = 1000 ether;

        vm.startPrank(user);
        token.approve(address(strategy), amount);
        strategy.deposit(amount);
        vm.stopPrank();

        uint256 yield = strategy.harvest();

        // 12% of 1000 = 120 ether
        assertEq(yield, 120 ether);
        assertEq(strategy.getBalance(), amount + 120 ether);
    }

    function test_Harvest_ZeroIfEmpty() public {
        uint256 yield = strategy.harvest();
        assertEq(yield, 0);
    }

    // ==================== getExpectedReturn ====================

    function test_GetExpectedReturn() public {
        // Replicate the contract's exact (rounded) math to avoid off-by-epsilon mismatches
        uint256 durationBlocks = uint256(365 days) / 13; // ~secondsPerYear / 13s-per-block
        uint256 durationSeconds = durationBlocks * 13;
        uint256 expected = (1 ether * 1200 * durationSeconds) / (10000 * 31536000);
        assertEq(strategy.getExpectedReturn(1 ether, durationBlocks), expected);
    }

    // ==================== checkSlippage ====================

    function test_CheckSlippage_Pass() public {
        assertTrue(strategy.checkSlippage(100, 100));
        assertTrue(strategy.checkSlippage(100, 150)); // minAmountOut > amount
    }

    function test_CheckSlippage_Fail() public {
        assertFalse(strategy.checkSlippage(100, 99));
    }

    // ==================== multiple deposits ====================

    function test_MultipleDeposits() public {
        uint256 amount1 = 500 ether;
        uint256 amount2 = 300 ether;

        vm.startPrank(user);
        token.approve(address(strategy), amount1 + amount2);
        strategy.deposit(amount1);
        strategy.deposit(amount2);
        vm.stopPrank();

        assertEq(strategy.getBalance(), amount1 + amount2);
    }

    // ==================== supportsInterface ====================

    function test_SupportsInterface() public {
        assertTrue(strategy.supportsInterface(type(IYieldStrategy).interfaceId));
    }
}

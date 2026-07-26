// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LendingStrategy, IPoolV3, IAToken} from "../contracts/LendingStrategy.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Test doubles for an Aave V3 market. They mimic the real economics:
//   * supply  -> pool takes underlying, mints aTokens 1:1
//   * withdraw-> pool burns aTokens, returns underlying
//   * interest-> extra aTokens minted to the depositor (rebasing balance),
//                 backed by underlying the test funds into the pool via deal()
// ─────────────────────────────────────────────────────────────────────────────

contract MockAToken is ERC20 {
    address public underlying;

    constructor(address _underlying) ERC20("Mock AToken", "aTKN") {
        underlying = _underlying;
    }

    function UNDERLYING_ASSET_ADDRESS() external view returns (address) {
        return underlying;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

contract MockAavePool {
    IERC20 public underlying;
    MockAToken public aToken;

    constructor(address _underlying, address _aToken) {
        underlying = IERC20(_underlying);
        aToken = MockAToken(_aToken);
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(asset == address(underlying), "wrong asset");
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount); // 1:1
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(asset == address(underlying), "wrong asset");
        aToken.burn(msg.sender, amount);
        IERC20(asset).transfer(to, amount);
        return amount;
    }

    /// @dev Simulate borrower interest: mint extra aTokens to the strategy.
    ///      The test funds the pool with matching underlying via deal() so the
    ///      pool can actually pay it out (this is what makes it "real" yield).
    function simulateInterest(address strategy, uint256 amount) external {
        aToken.mint(strategy, amount);
    }
}

contract LendingStrategyTest is Test {
    ERC20 internal underlying;
    MockAToken internal aToken;
    MockAavePool internal pool;
    LendingStrategy internal strategy;

    address internal vault = makeAddr("vault");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant DEPOSIT = 1000 ether;
    uint256 internal constant INTEREST = 120 ether; // 12% of 1000

    function setUp() public {
        underlying = new ERC20("Mock USD", "mUSD");
        aToken = new MockAToken(address(underlying));
        pool = new MockAavePool(address(underlying), address(aToken));

        strategy = new LendingStrategy(address(pool), address(aToken));

        // The TreasuryVault calls initialize in addStrategy -> owner = vault
        vm.prank(vault);
        strategy.initialize(address(underlying));
    }

    function _deposit(uint256 amount) internal {
        deal(address(underlying), vault, amount);
        vm.startPrank(vault);
        underlying.approve(address(strategy), amount);
        strategy.deposit(amount);
        vm.stopPrank();
    }

    // ── initialize ───────────────────────────────────────────────────────────

    function test_Initialize_SetsOwnerAndAsset() public {
        assertEq(strategy.owner(), vault);
        assertEq(strategy.getStrategyAsset(), address(underlying));
        assertEq(strategy.getAPY(), 0);
    }

    function test_Initialize_RevertAssetMismatch() public {
        LendingStrategy s2 = new LendingStrategy(address(pool), address(aToken));
        address wrongAsset = makeAddr("wrong");
        vm.prank(vault);
        vm.expectRevert("Asset/aToken mismatch");
        s2.initialize(wrongAsset);
    }

    function test_Initialize_CannotReinitialize() public {
        vm.prank(vault);
        vm.expectRevert("Initializable: contract is already initialized");
        strategy.initialize(address(underlying));
    }

    // ── deposit ──────────────────────────────────────────────────────────────

    function test_Deposit_SuppliesToPool() public {
        _deposit(DEPOSIT);

        assertEq(strategy.getBalance(), DEPOSIT);          // 1:1 aTokens
        assertEq(strategy.totalDeposited(), DEPOSIT);
        assertEq(underlying.balanceOf(address(pool)), DEPOSIT); // pool custody
        assertEq(underlying.balanceOf(address(strategy)), 0);   // strategy holds aTokens, not underlying
    }

    function test_Deposit_RevertNotOwner() public {
        deal(address(underlying), stranger, DEPOSIT);
        vm.startPrank(stranger);
        underlying.approve(address(strategy), DEPOSIT);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.deposit(DEPOSIT);
        vm.stopPrank();
    }

    // ── harvest: REAL yield, solvent ─────────────────────────────────────────

    function test_Harvest_RealYield_Solvent() public {
        _deposit(DEPOSIT);

        // Borrowers pay 12% interest: mint aTokens to strategy + fund pool so it
        // can actually redeem them. This is real, backed yield — not minted air.
        pool.simulateInterest(address(strategy), INTEREST);
        deal(address(underlying), address(pool), DEPOSIT + INTEREST);

        assertEq(strategy.getBalance(), DEPOSIT + INTEREST);

        vm.warp(block.timestamp + 365 days); // let a year pass for APY math

        uint256 vaultBefore = underlying.balanceOf(vault);
        vm.prank(vault);
        uint256 yield = strategy.harvest();

        assertEq(yield, INTEREST, "yield should equal real interest");
        assertEq(underlying.balanceOf(vault), vaultBefore + INTEREST, "vault received real tokens");
        assertEq(strategy.getBalance(), DEPOSIT, "principal stays supplied");
        assertEq(strategy.totalDeposited(), DEPOSIT, "principal accounting intact");
        // Realized APY ≈ 12% (1200 bps) over exactly one year
        assertApproxEqAbs(strategy.getAPY(), 1200, 5, "realized APY ~12%");
    }

    function test_Harvest_ZeroWhenNoInterest() public {
        _deposit(DEPOSIT);
        vm.prank(vault);
        uint256 yield = strategy.harvest();
        assertEq(yield, 0);
    }

    function test_Harvest_RevertNotOwner() public {
        _deposit(DEPOSIT);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.harvest();
    }

    // ── withdraw ─────────────────────────────────────────────────────────────

    function test_Withdraw_ReturnsPrincipal() public {
        _deposit(DEPOSIT);

        uint256 before = underlying.balanceOf(vault);
        vm.prank(vault);
        strategy.withdraw(DEPOSIT);

        assertEq(underlying.balanceOf(vault), before + DEPOSIT);
        assertEq(strategy.getBalance(), 0);
        assertEq(strategy.totalDeposited(), 0);
    }

    function test_Withdraw_AfterHarvest_StillSolvent() public {
        _deposit(DEPOSIT);
        pool.simulateInterest(address(strategy), INTEREST);
        deal(address(underlying), address(pool), DEPOSIT + INTEREST);
        vm.warp(block.timestamp + 365 days);

        // harvest the interest first
        vm.prank(vault);
        strategy.harvest();

        // then withdraw full principal — must be fully backed
        uint256 before = underlying.balanceOf(vault);
        vm.prank(vault);
        strategy.withdraw(DEPOSIT);
        assertEq(underlying.balanceOf(vault), before + DEPOSIT);
        assertEq(strategy.getBalance(), 0);
    }

    function test_Withdraw_RevertNotOwner() public {
        _deposit(DEPOSIT);
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.withdraw(DEPOSIT);
    }

    function test_Withdraw_RevertInsufficient() public {
        _deposit(DEPOSIT);
        vm.prank(vault);
        vm.expectRevert("Insufficient balance");
        strategy.withdraw(DEPOSIT + 1);
    }

    // ── full lifecycle: deposit -> earn -> harvest -> withdraw ───────────────

    function test_FullLifecycle_NoLeakage() public {
        _deposit(DEPOSIT);

        // two rounds of interest
        pool.simulateInterest(address(strategy), INTEREST);
        deal(address(underlying), address(pool), DEPOSIT + INTEREST);
        vm.warp(block.timestamp + 180 days);
        vm.prank(vault);
        uint256 y1 = strategy.harvest();

        pool.simulateInterest(address(strategy), INTEREST);
        deal(address(underlying), address(pool), DEPOSIT + INTEREST);
        vm.warp(block.timestamp + 365 days);
        vm.prank(vault);
        uint256 y2 = strategy.harvest();

        // withdraw principal
        vm.prank(vault);
        strategy.withdraw(DEPOSIT);

        // vault ends with principal + both yields; nothing leaked, nothing minted
        assertEq(y1, INTEREST);
        assertEq(y2, INTEREST);
        assertEq(underlying.balanceOf(vault), DEPOSIT + INTEREST + INTEREST);
        assertEq(strategy.getBalance(), 0);
    }
}

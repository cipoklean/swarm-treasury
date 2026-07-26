// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IYieldStrategy} from "./IYieldStrategy.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Aave V3 interfaces (verified against aave/aave-v3-core IPool.sol /
// IAToken.sol). Only the functions this adapter uses are declared.
// ─────────────────────────────────────────────────────────────────────────────
interface IPoolV3 {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAToken is IERC20 {
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

/// @title LendingStrategy
/// @notice Production yield adapter that supplies treasury assets into an
///         Aave V3-style lending pool and harvests REAL borrower interest.
/// @dev Implements IYieldStrategy so the TreasuryVault and agents use it with
///      zero changes. The owner is set to the TreasuryVault at `initialize`
///      time (the vault calls initialize in addStrategy), so deposit/withdraw/
///      harvest are vault-only. Unlike MockYieldStrategy, `harvest` returns
///      interest actually earned on-chain — never minted from nothing — and
///      the strategy stays fully solvent (principal + interest always backed
///      1:1 by aTokens redeemable for the underlying).
contract LendingStrategy is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, IYieldStrategy {
    using SafeERC20 for IERC20;

    address public asset;
    uint256 public apyBps;          // last REALIZED APY in basis points (updated on harvest)
    uint256 public totalDeposited;  // principal currently supplied (excludes harvested interest)
    uint256 public lastHarvestTime;

    IPoolV3 public immutable pool;
    IAToken public immutable aToken;

    uint256 private constant FIXED_POINT_SCALE = 10000;

    event YieldHarvested(address indexed strategy, uint256 yield, uint256 realizedApyBps);

    constructor(address _pool, address _aToken) {
        require(_pool != address(0), "Invalid pool");
        require(_aToken != address(0), "Invalid aToken");
        pool = IPoolV3(_pool);
        aToken = IAToken(_aToken);
    }

    /// @notice Called by the TreasuryVault in addStrategy. Sets owner = vault.
    function initialize(address _asset) public initializer {
        _init(_asset, 0);
    }

    /// @notice IYieldStrategy also declares a 2-arg initialize; supported for
    ///         interface completeness, lets a deployer seed an APY hint.
    function initialize(address _asset, uint256 _apyHintBps) external initializer {
        _init(_asset, _apyHintBps);
    }

    function _init(address _asset, uint256 _apyHintBps) internal {
        __Ownable_init();
        __ReentrancyGuard_init();
        require(_asset != address(0), "Invalid asset");
        // Guard against wiring the wrong aToken to the wrong asset.
        require(aToken.UNDERLYING_ASSET_ADDRESS() == _asset, "Asset/aToken mismatch");
        asset = _asset;
        apyBps = _apyHintBps;
        lastHarvestTime = block.timestamp;
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getAPY() external view override returns (uint256) {
        return apyBps;
    }

    function getStrategyAsset() external view override returns (address) {
        return asset;
    }

    /// @notice aTokens rebase, so balanceOf already includes accrued interest.
    function getBalance() public view override returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    function getExpectedReturn(uint256 amount, uint256 duration) external view override returns (uint256) {
        // Estimate using last realized APY. `duration` is in blocks (~13s each,
        // matching the base convention); simple-interest approximation.
        uint256 durationSeconds = duration * 13;
        return (amount * apyBps * durationSeconds) / (FIXED_POINT_SCALE * 365 days);
    }

    /// @notice Lending supply/withdraw is 1:1 — no swap slippage expected.
    function checkSlippage(uint256 amountIn, uint256 minAmountOut) external pure override returns (bool) {
        return minAmountOut >= amountIn;
    }

    // ── Mutative (vault-only) ────────────────────────────────────────────────

    /// @notice Pulls `amount` from the vault and supplies it into the pool.
    function deposit(uint256 amount) external override nonReentrant onlyOwner returns (bool) {
        require(amount > 0, "Amount must be > 0");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).safeIncreaseAllowance(address(pool), amount);
        pool.supply(asset, amount, address(this), 0);

        totalDeposited += amount;
        emit Deposited(address(this), asset, amount);
        return true;
    }

    /// @notice Redeems `amount` from the pool back to the vault (owner).
    function withdraw(uint256 amount) external override nonReentrant onlyOwner returns (bool) {
        require(amount > 0, "Amount must be > 0");
        require(getBalance() >= amount, "Insufficient balance");

        // Reduce principal tracking; withdrawing more than principal means we're
        // also pulling un-harvested interest, so clamp at totalDeposited.
        uint256 principalPortion = amount > totalDeposited ? totalDeposited : amount;
        totalDeposited -= principalPortion;

        pool.withdraw(asset, amount, msg.sender);
        emit Withdrawn(address(this), asset, amount);
        return true;
    }

    /// @notice Realizes accrued interest: computes yield above principal,
    ///         withdraws it to the vault, and records the realized APY.
    /// @return yield The amount of real interest sent to the vault.
    function harvest() external override nonReentrant onlyOwner returns (uint256) {
        uint256 bal = getBalance();
        if (bal <= totalDeposited) {
            return 0; // no interest accrued yet
        }
        uint256 yield = bal - totalDeposited;

        // Pull the interest out to the vault; principal stays supplied.
        pool.withdraw(asset, yield, msg.sender);

        // Record realized APY from actual earned interest over elapsed time.
        uint256 elapsed = block.timestamp - lastHarvestTime;
        if (elapsed > 0 && totalDeposited > 0) {
            apyBps = (yield * 365 days * FIXED_POINT_SCALE) / (totalDeposited * elapsed);
        }
        lastHarvestTime = block.timestamp;

        emit Harvested(address(this), yield);
        emit YieldHarvested(address(this), yield, apyBps);
        return yield;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IYieldStrategy).interfaceId;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IYieldStrategy} from "./IYieldStrategy.sol";

abstract contract YieldStrategy is Initializable, OwnableUpgradeable, IYieldStrategy {
    using SafeERC20 for IERC20;

    address public asset;
    uint256 public apyBps; // Fixed-point APY in basis points (e.g., 1200 = 12%)
    uint256 public totalDeposited;
    uint256 public maxSlippageBps = 50; // 0.5%

    uint256 private constant FIXED_POINT_SCALE = 10000;

    function initialize(address _asset, uint256 _apyBps) public virtual initializer {
        __Ownable_init();
        require(_asset != address(0), "Invalid asset address");
        require(_apyBps <= 1000000, "APY too high"); // Cap at 10000% for safety

        asset = _asset;
        apyBps = _apyBps;
    }

    function getAPY() external view override returns (uint256) {
        return apyBps;
    }

    function getStrategyAsset() external view override returns (address) {
        return asset;
    }

    function getBalance() external view virtual override returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function getExpectedReturn(uint256 amount, uint256 duration) external view override returns (uint256) {
        // Simple interest: principal * apy * durationSeconds / (FIXED_POINT_SCALE * secondsPerYear)
        // duration is in blocks; assume ~13 seconds per block
        uint256 durationSeconds = duration * 13;
        return (amount * apyBps * durationSeconds) / (FIXED_POINT_SCALE * 365 days);
    }

    function checkSlippage(uint256 amountIn, uint256 minAmountOut) external pure override returns (bool) {
        // For the base implementation, we assume no slippage
        // Real implementations would check against pool state
        return minAmountOut >= amountIn;
    }

    function deposit(uint256 amount) external virtual override returns (bool) {
        require(amount > 0, "Amount must be > 0");
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        
        emit Deposited(address(this), asset, amount);
        return true;
    }

    function withdraw(uint256 amount) external virtual override returns (bool) {
        require(amount > 0, "Amount must be > 0");
        require(IERC20(asset).balanceOf(address(this)) >= amount, "Insufficient balance");
        
        IERC20(asset).safeTransfer(msg.sender, amount);
        
        emit Withdrawn(address(this), asset, amount);
        return true;
    }

    function harvest() external virtual override returns (uint256) {
        // Base implementation returns 0
        // Real implementations would calculate and distribute yield
        return 0;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IYieldStrategy).interfaceId;
    }
}

// Mock implementation for testnet demo
contract MockYieldStrategy is YieldStrategy {
    using SafeERC20 for IERC20;
    uint256 private mockYieldBalance;

    function initialize(address _asset) public virtual initializer {
        __Ownable_init();
        require(_asset != address(0), "Invalid asset address");
        asset = _asset;
        apyBps = 1200; // 12% APY
    }

    function deposit(uint256 amount) external override returns (bool) {
        require(amount > 0, "Amount must be > 0");
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        mockYieldBalance += amount;
        
        emit Deposited(address(this), asset, amount);
        return true;
    }

    function withdraw(uint256 amount) external override onlyOwner returns (bool) {
        require(amount > 0, "Amount must be > 0");
        require(mockYieldBalance >= amount, "Insufficient mock balance");
        
        mockYieldBalance -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);
        
        emit Withdrawn(address(this), asset, amount);
        return true;
    }

    function harvest() external override onlyOwner returns (uint256) {
        // Simulate 12% APY yield
        uint256 yieldAmount = (mockYieldBalance * 1200) / 10000; // 12%
        if (yieldAmount > 0) {
            mockYieldBalance += yieldAmount;
            emit Harvested(address(this), yieldAmount);
        }
        return yieldAmount;
    }

    function getBalance() external view override returns (uint256) {
        return mockYieldBalance;
    }
}

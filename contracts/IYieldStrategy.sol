// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IYieldStrategy {
    function initialize(address asset, uint256 apyBps) external;
    function initialize(address asset) external;
    function getAPY() external view returns (uint256);

    function deposit(uint256 amount) external returns (bool);

    function withdraw(uint256 amount) external returns (bool);

    function getBalance() external view returns (uint256);

    function harvest() external returns (uint256);

    function getStrategyAsset() external view returns (address);

    function getExpectedReturn(uint256 amount, uint256 duration) external view returns (uint256);

    function checkSlippage(uint256 amountIn, uint256 minAmountOut) external view returns (bool);

    event Deposited(address indexed strategy, address indexed asset, uint256 amount);
    event Withdrawn(address indexed strategy, address indexed asset, uint256 amount);
    event Harvested(address indexed strategy, uint256 amount);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasury {
    // Treasury state
    function treasury() external view returns (address);
    function treasurer() external view returns (address);
    function pendingTreasurer() external view returns (address);
    function guardian() external view returns (address);
    function pendingGuardian() external view returns (address);

    // Proposal management
    function proposalCount() external view returns (uint256);
    function proposals(uint256 id) external view returns (
        address proposer,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool cancelled
    );
    function votes(uint256 proposalId, address voter) external view returns (bool);
    function proposalThreshold() external view returns (uint256);
    function votingDelay() external view returns (uint256);
    function votingPeriod() external view returns (uint256);
    function quorum() external view returns (uint256);

    // Pause control (gated by GOVERNOR_ROLE on the vault)
    function pause() external;
    function unpause() external;

    // Treasury operations
    function assetWhitelist(address asset) external view returns (bool);
    function whitelistedAssets(uint256 index) external view returns (address);
    function whitelistedAssetsLength() external view returns (uint256);
    function assetLimits(address asset) external view returns (uint256 maxAmount, uint256 timeWindow, uint256 usedAmount, uint256 windowStart);
    function treasuryBalance(address asset) external view returns (uint256);

    // Yield strategies
    function strategyCount() external view returns (uint256);
    function strategies(uint256 index) external view returns (address);
    function strategyConfig(address strategy) external view returns (
        address asset,
        uint256 maxAllocation,
        uint256 currentAllocation,
        bool active,
        uint256 minReturnBps,
        uint256 maxSlippageBps
    );
    function strategyMetrics(address strategy) external view returns (
        uint256 totalDeposited,
        uint256 totalYield,
        uint256 lastHarvest,
        uint256 apyBps
    );

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, address indexed target, uint256 value, bytes data, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event TreasurerChanged(address indexed oldTreasurer, address indexed newTreasurer);
    event GuardianChanged(address indexed oldGuardian, address indexed newGuardian);
    event AssetWhitelisted(address indexed asset, uint256 maxAmount, uint256 timeWindow);
    event AssetLimitUpdated(address indexed asset, uint256 maxAmount, uint256 timeWindow);
    event AssetWhitelistedRemoved(address indexed asset);
    event StrategyAdded(address indexed strategy, address indexed asset, uint256 maxAllocation, uint256 minReturnBps, uint256 maxSlippageBps);
    event StrategyRemoved(address indexed strategy);
    event StrategyUpdated(address indexed strategy, uint256 maxAllocation, bool active);
    event StrategyHarvested(address indexed strategy, uint256 amount);
    event StrategyDeposited(address indexed strategy, uint256 amount);
    event StrategyWithdrawn(address indexed strategy, uint256 amount);
    event TreasuryDeposit(address indexed asset, uint256 amount, address indexed from);
    event TreasuryWithdrawal(address indexed asset, uint256 amount, address indexed to);
    event AssetLimitExceeded(address indexed asset, uint256 attempted, uint256 limit);
    event EmergencyWithdrawal(address indexed asset, uint256 amount, address indexed to, address indexed guardian);
    event EmergencyPause(address indexed guardian);
    event EmergencyUnpause(address indexed guardian);
}
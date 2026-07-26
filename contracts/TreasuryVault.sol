// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITreasury} from "./ITreasury.sol";
import {IAgentRegistry} from "./IAgentRegistry.sol";
import {IMessageBus} from "./IMessageBus.sol";
import {IYieldStrategy} from "./IYieldStrategy.sol";
import {IGovernor} from "./IGovernor.sol";

contract TreasuryVault is Initializable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, ITreasury {
    using SafeERC20 for IERC20;

    bytes32 public constant YIELD_SCOUT_ROLE = keccak256("YIELD_SCOUT_ROLE");
    bytes32 public constant RISK_GUARD_ROLE = keccak256("RISK_GUARD_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    struct Proposal {
        address proposer;
        address target;
        uint256 value;
        bytes data;
        uint256 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool cancelled;
        bool yieldScoutApproved;
        bool riskGuardApproved;
        uint256 approvedAtBlock; // block when final approval landed (for execution delay)
    }

    struct AssetLimit {
        uint256 maxAmount;
        uint256 timeWindow;
        uint256 usedAmount;
        uint256 windowStart;
    }

    struct StrategyConfig {
        address asset;
        uint256 maxAllocation;
        uint256 currentAllocation;
        bool active;
        uint256 minReturnBps;
        uint256 maxSlippageBps;
    }

    struct StrategyMetrics {
        uint256 totalDeposited;
        uint256 totalYield;
        uint256 lastHarvest;
        uint256 apyBps;
    }

    address public treasury;
    address public treasurer;
    address public pendingTreasurer;
    address public guardian;
    address public pendingGuardian;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => bool)) public votes;

    uint256 public proposalThreshold = 1;
    uint256 public votingDelay = 1;
    uint256 public votingPeriod = 200; // ~150s on BOT Chain (0.75s blocks)
    uint256 public quorum = 1;

    address[] public whitelistedAssets;
    mapping(address => bool) public assetWhitelist;
    mapping(address => AssetLimit) public assetLimits;
    mapping(address => uint256) public treasuryBalance;

    address[] public strategies;
    mapping(address => StrategyConfig) public strategyConfig;
    mapping(address => StrategyMetrics) public strategyMetrics;

    IAgentRegistry public agentRegistry;
    IMessageBus public messageBus;

    address public governorContract;

    uint256 public constant MIN_TIMELOCK_BLOCKS = 2;
    uint256 public constant MAX_SLIPPAGE_BPS = 50;
    uint256 public constant LARGE_MOVE_THRESHOLD_BPS = 2000;
    uint256 public constant EXECUTION_DELAY = 100; // ~75s on BOT Chain (0.75s blocks)
    uint256 public constant MAX_SINGLE_MOVE_BPS = 2000; // 20% of treasury per action
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 3; // consecutive vetoes before auto-pause

    uint256 public consecutiveVetoes;

    event YieldScoutApproved(uint256 indexed proposalId, address indexed agent);
    event RiskGuardApproved(uint256 indexed proposalId, address indexed agent);
    event AgentRegistrySet(address indexed registry);
    event MessageBusSet(address indexed messageBus);
    event WithdrawalTimelockSet(uint256 blocks);
    event CircuitBreakerTriggered(uint256 consecutiveVetoes, address triggeredBy);

    function initialize(
        address _treasurer,
        address _guardian,
        address _agentRegistry,
        address _messageBus
    ) external initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNOR_ROLE, msg.sender);

        treasurer = _treasurer;
        guardian = _guardian;
        agentRegistry = IAgentRegistry(_agentRegistry);
        messageBus = IMessageBus(_messageBus);

        emit AgentRegistrySet(_agentRegistry);
        emit MessageBusSet(_messageBus);
    }

    function setAgentRegistry(address _registry) external onlyRole(GOVERNOR_ROLE) {
        agentRegistry = IAgentRegistry(_registry);
        emit AgentRegistrySet(_registry);
    }

    function setMessageBus(address _messageBus) external onlyRole(GOVERNOR_ROLE) {
        messageBus = IMessageBus(_messageBus);
        emit MessageBusSet(_messageBus);
    }

    function setGovernorContract(address _gov) external onlyRole(GOVERNOR_ROLE) {
        governorContract = _gov;
    }

    function deposit(address asset, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(assetWhitelist[asset], "Asset not whitelisted");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        treasuryBalance[asset] += amount;

        emit TreasuryDeposit(asset, amount, msg.sender);
    }

    function executeProposal(uint256 proposalId) external nonReentrant whenNotPaused onlyRole(EXECUTOR_ROLE) {
        Proposal storage proposal = _proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Cancelled");
        require(block.number <= proposal.deadline, "Proposal expired");
        require(proposal.yieldScoutApproved, "Yield Scout not approved");
        require(proposal.riskGuardApproved, "Risk Guard not approved");
        require(proposal.forVotes >= quorum, "Quorum not met");
        require(
            proposal.approvedAtBlock > 0 && block.number >= proposal.approvedAtBlock + EXECUTION_DELAY,
            "Execution delay not elapsed"
        );

        proposal.executed = true;

        if (proposal.target == address(this)) {
            // Self-targeted actions (depositToStrategy / withdrawFromStrategy) are invoked
            // internally so msg.sender remains the EXECUTOR, preserving role-gated authority
            // while still routing through this access-controlled entry point.
            bytes4 selector = bytes4(proposal.data);
            require(
                selector == this.depositToStrategy.selector || selector == this.withdrawFromStrategy.selector,
                "Unsupported vault action"
            );
            (bool success, ) = address(this).call(proposal.data);
            require(success, "Execution failed");
        } else {
            (bool success, ) = proposal.target.call{value: proposal.value}(proposal.data);
            require(success, "Execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    function createProposal(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external nonReentrant whenNotPaused onlyRole(YIELD_SCOUT_ROLE) {
        require(target != address(0), "Invalid target");
        require(agentRegistry.hasRole(YIELD_SCOUT_ROLE, msg.sender), "Not Yield Scout");

        proposalCount++;
        _proposals[proposalCount] = Proposal({
            proposer: msg.sender,
            target: target,
            value: value,
            data: data,
            deadline: block.number + votingDelay + votingPeriod,
            forVotes: 0,
            againstVotes: 0,
            executed: false,
            cancelled: false,
            yieldScoutApproved: true,
            riskGuardApproved: false,
            approvedAtBlock: 0
        });

        emit ProposalCreated(proposalCount, msg.sender, target, value, data, _proposals[proposalCount].deadline);

        messageBus.postMessage(
            proposalCount,
            uint8(1),
            uint8(0),
            block.number,
            keccak256(abi.encodePacked(description))
        );
    }

    function approveProposal(uint256 proposalId) external nonReentrant whenNotPaused {
        Proposal storage proposal = _proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Cancelled");

        if (agentRegistry.hasRole(RISK_GUARD_ROLE, msg.sender)) {
            require(!proposal.riskGuardApproved, "Already approved by Risk Guard");
            proposal.riskGuardApproved = true;
            // Record when the final approval landed — execution delay starts here
            if (proposal.yieldScoutApproved) {
                proposal.approvedAtBlock = block.number;
            }
            consecutiveVetoes = 0; // reset circuit breaker on approval
            emit RiskGuardApproved(proposalId, msg.sender);

            messageBus.postMessage(
                proposalId,
                uint8(2),
                uint8(1),
                block.number,
                keccak256("RISK_GUARD_APPROVED")
            );
        } else if (agentRegistry.hasRole(YIELD_SCOUT_ROLE, msg.sender)) {
            require(!proposal.yieldScoutApproved, "Already approved by Yield Scout");
            proposal.yieldScoutApproved = true;
            // If risk guard already approved, record the approval block now
            if (proposal.riskGuardApproved) {
                proposal.approvedAtBlock = block.number;
            }
            emit YieldScoutApproved(proposalId, msg.sender);

            messageBus.postMessage(
                proposalId,
                uint8(1),
                uint8(1),
                block.number,
                keccak256("YIELD_SCOUT_APPROVED")
            );
        } else {
            revert("Not authorized to approve");
        }
    }

    function vetoProposal(uint256 proposalId, string calldata reason) external nonReentrant whenNotPaused onlyRole(RISK_GUARD_ROLE) {
        Proposal storage proposal = _proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Already cancelled");
        require(block.number < proposal.deadline, "Voting ended");

        proposal.cancelled = true;
        consecutiveVetoes++;
        emit ProposalCancelled(proposalId);

        // Circuit breaker: auto-pause after too many consecutive vetoes
        if (consecutiveVetoes >= CIRCUIT_BREAKER_THRESHOLD) {
            _pause();
            emit CircuitBreakerTriggered(consecutiveVetoes, msg.sender);
        }

        messageBus.postMessage(
            proposalId,
            uint8(2),
            uint8(2),
            block.number,
            keccak256(abi.encodePacked(reason))
        );
    }

    function vote(uint256 proposalId, bool support) external nonReentrant whenNotPaused {
        Proposal storage proposal = _proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Cancelled");
        require(block.number >= proposal.deadline - votingPeriod, "Voting not started");
        require(block.number <= proposal.deadline, "Voting ended");
        require(!votes[proposalId][msg.sender], "Already voted");

        votes[proposalId][msg.sender] = true;
        if (support) {
            proposal.forVotes++;
        } else {
            proposal.againstVotes++;
        }

        emit VoteCast(proposalId, msg.sender, support, 1);
    }

    function proposals(uint256 id) external view override returns (
        address proposer,
        address target,
        uint256 value,
        bytes memory data,
        uint256 deadline,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool cancelled
    ) {
        Proposal storage p = _proposals[id];
        return (p.proposer, p.target, p.value, p.data, p.deadline, p.forVotes, p.againstVotes, p.executed, p.cancelled);
    }

    function getProposalApprovals(uint256 id) external view returns (bool yieldScoutApproved, bool riskGuardApproved) {
        Proposal storage p = _proposals[id];
        return (p.yieldScoutApproved, p.riskGuardApproved);
    }

    function strategyCount() external view override returns (uint256) {
        return strategies.length;
    }

    function whitelistedAssetsLength() external view override returns (uint256) {
        return whitelistedAssets.length;
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to,
        uint256 timelockBlocks
    ) external nonReentrant whenNotPaused onlyRole(GOVERNOR_ROLE) {
        require(amount > 0, "Amount must be > 0");
        require(assetWhitelist[asset], "Asset not whitelisted");
        require(treasuryBalance[asset] >= amount, "Insufficient balance");
        require(timelockBlocks >= MIN_TIMELOCK_BLOCKS, "Timelock too short");

        AssetLimit storage limit = assetLimits[asset];
        if (limit.maxAmount > 0) {
            if (block.number >= limit.windowStart + limit.timeWindow) {
                limit.usedAmount = 0;
                limit.windowStart = block.number;
            }
            require(limit.usedAmount + amount <= limit.maxAmount, "Asset limit exceeded");
            limit.usedAmount += amount;
        }

        uint256 largeMoveBps = LARGE_MOVE_THRESHOLD_BPS;
        if (governorContract != address(0)) {
            try IGovernor(governorContract).getLargeMoveThreshold() returns (uint256 t) {
                if (t > 0) largeMoveBps = t;
            } catch {}
        }
        if (amount * 10000 >= treasuryBalance[asset] * largeMoveBps) {
            require(hasRole(GOVERNOR_ROLE, msg.sender) || msg.sender == guardian, "Governor approval required");
        }

        treasuryBalance[asset] -= amount;
        IERC20(asset).safeTransfer(to, amount);

        emit TreasuryWithdrawal(asset, amount, to);
    }

    function emergencyWithdraw(address asset, uint256 amount, address to) external nonReentrant onlyRole(GOVERNOR_ROLE) {
        require(amount > 0, "Amount must be > 0");
        require(to != address(0), "Invalid recipient");
        require(treasuryBalance[asset] >= amount, "Insufficient balance");

        treasuryBalance[asset] -= amount;
        IERC20(asset).safeTransfer(to, amount);

        emit EmergencyWithdrawal(asset, amount, to, msg.sender);
    }

    function addAssetToWhitelist(address asset, uint256 maxAmount, uint256 timeWindow) external onlyRole(GOVERNOR_ROLE) {
        require(!assetWhitelist[asset], "Already whitelisted");
        assetWhitelist[asset] = true;
        whitelistedAssets.push(asset);
        assetLimits[asset] = AssetLimit(maxAmount, timeWindow, 0, block.number);
        emit AssetWhitelisted(asset, maxAmount, timeWindow);
    }

    function updateAssetLimit(address asset, uint256 maxAmount, uint256 timeWindow) external onlyRole(GOVERNOR_ROLE) {
        require(assetWhitelist[asset], "Not whitelisted");
        assetLimits[asset] = AssetLimit(maxAmount, timeWindow, 0, block.number);
        emit AssetLimitUpdated(asset, maxAmount, timeWindow);
    }

    function removeAssetFromWhitelist(address asset) external onlyRole(GOVERNOR_ROLE) {
        require(assetWhitelist[asset], "Not whitelisted");
        assetWhitelist[asset] = false;
        for (uint256 i = 0; i < whitelistedAssets.length; i++) {
            if (whitelistedAssets[i] == asset) {
                whitelistedAssets[i] = whitelistedAssets[whitelistedAssets.length - 1];
                whitelistedAssets.pop();
                break;
            }
        }
        emit AssetWhitelistedRemoved(asset);
    }

    function addStrategy(
        address strategy,
        address asset,
        uint256 maxAllocation,
        uint256 minReturnBps,
        uint256 maxSlippageBps
    ) external onlyRole(GOVERNOR_ROLE) {
        require(maxSlippageBps <= MAX_SLIPPAGE_BPS, "Slippage too high");
        require(assetWhitelist[asset], "Asset not whitelisted");
        require(strategyConfig[strategy].asset == address(0), "Strategy exists");

        IYieldStrategy(strategy).initialize(asset);
        strategyConfig[strategy] = StrategyConfig({
            asset: asset,
            maxAllocation: maxAllocation,
            currentAllocation: 0,
            active: true,
            minReturnBps: minReturnBps,
            maxSlippageBps: maxSlippageBps
        });
        strategies.push(strategy);
        emit StrategyAdded(strategy, asset, maxAllocation, minReturnBps, maxSlippageBps);
    }

    function removeStrategy(address strategy) external onlyRole(GOVERNOR_ROLE) {
        require(strategyConfig[strategy].asset != address(0), "Strategy not found");
        require(strategyConfig[strategy].currentAllocation == 0, "Strategy has allocation");
        delete strategyConfig[strategy];
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == strategy) {
                strategies[i] = strategies[strategies.length - 1];
                strategies.pop();
                break;
            }
        }
        emit StrategyRemoved(strategy);
    }

    function updateStrategy(address strategy, uint256 maxAllocation, bool active) external onlyRole(GOVERNOR_ROLE) {
        require(strategyConfig[strategy].asset != address(0), "Strategy not found");
        strategyConfig[strategy].maxAllocation = maxAllocation;
        strategyConfig[strategy].active = active;
        emit StrategyUpdated(strategy, maxAllocation, active);
    }

    function depositToStrategy(address strategy, uint256 amount) external whenNotPaused {
        require(msg.sender == address(this), "Only callable via executeProposal");
        StrategyConfig storage config = strategyConfig[strategy];
        require(config.asset != address(0), "Strategy not found");
        require(config.active, "Strategy not active");
        require(config.currentAllocation + amount <= config.maxAllocation, "Exceeds max allocation");
        require(treasuryBalance[config.asset] >= amount, "Insufficient treasury balance");
        require(
            amount * 10000 <= treasuryBalance[config.asset] * MAX_SINGLE_MOVE_BPS,
            "Exceeds single-move cap"
        );

        treasuryBalance[config.asset] -= amount;
        config.currentAllocation += amount;
        strategyMetrics[strategy].totalDeposited += amount;

        IERC20(config.asset).safeIncreaseAllowance(strategy, amount);
        IYieldStrategy(strategy).deposit(amount);

        emit StrategyDeposited(strategy, amount);
    }

    function withdrawFromStrategy(address strategy, uint256 amount) external whenNotPaused {
        require(msg.sender == address(this), "Only callable via executeProposal");
        StrategyConfig storage config = strategyConfig[strategy];
        require(config.asset != address(0), "Strategy not found");
        require(config.currentAllocation >= amount, "Insufficient allocation");

        config.currentAllocation -= amount;
        IYieldStrategy(strategy).withdraw(amount);
        treasuryBalance[config.asset] += amount;

        emit StrategyWithdrawn(strategy, amount);
    }

    function harvestStrategy(address strategy) external nonReentrant whenNotPaused onlyRole(EXECUTOR_ROLE) {
        StrategyConfig storage config = strategyConfig[strategy];
        require(config.asset != address(0), "Strategy not found");

        uint256 yield = IYieldStrategy(strategy).harvest();
        strategyMetrics[strategy].totalYield += yield;
        strategyMetrics[strategy].lastHarvest = block.number;
        treasuryBalance[config.asset] += yield;

        emit StrategyHarvested(strategy, yield);
    }

    function setTreasurer(address newTreasurer) external onlyRole(GOVERNOR_ROLE) {
        require(newTreasurer != address(0), "Invalid address");
        address oldTreasurer = treasurer;
        treasurer = newTreasurer;
        emit TreasurerChanged(oldTreasurer, newTreasurer);
    }

    function setGuardian(address newGuardian) external onlyRole(GOVERNOR_ROLE) {
        require(newGuardian != address(0), "Invalid address");
        address oldGuardian = guardian;
        guardian = newGuardian;
        emit GuardianChanged(oldGuardian, newGuardian);
    }

    function pause() external onlyRole(GOVERNOR_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender);
    }

    function unpause() external onlyRole(GOVERNOR_ROLE) {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }

    function _pause() internal virtual override {
        super._pause();
    }

    function _unpause() internal virtual override {
        super._unpause();
    }

    receive() external payable {}
}
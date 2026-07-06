// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IGovernor} from "./IGovernor.sol";
import {ITreasury} from "./ITreasury.sol";
import {IAgentRegistry} from "./IAgentRegistry.sol";
import {IMessageBus} from "./IMessageBus.sol";

contract Governor is Initializable, OwnableUpgradeable, PausableUpgradeable, AccessControlUpgradeable, IGovernor {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant YIELD_SCOUT_ROLE = keccak256("YIELD_SCOUT_ROLE");
    bytes32 public constant RISK_GUARD_ROLE = keccak256("RISK_GUARD_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    ITreasury public treasuryVault;
    IAgentRegistry public agentRegistry;
    IMessageBus public messageBus;

    uint256 public slippageTolerance = 50; // 0.5% in basis points
    uint256 public timelockDuration = 24; // 24 blocks
    uint256 public apyThreshold = 1000; // 10% in basis points
    uint256 public largeMoveThreshold = 2000; // 20% in basis points

    uint256 public parameterUpdateTimelock = 24; // 24 blocks for parameter changes
    mapping(bytes32 => uint256) public pendingParameterUpdates;
    mapping(bytes32 => uint256) public parameterUpdateTimestamps;

    event ParameterUpdateScheduled(
        bytes32 indexed paramName,
        uint256 oldValue,
        uint256 newValue,
        uint256 effectiveBlock
    );

    function initialize(
        address _treasuryVault,
        address _agentRegistry,
        address _messageBus
    ) external initializer {
        __Ownable_init();
        __Pausable_init();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNOR_ROLE, msg.sender);

        require(_treasuryVault != address(0), "Invalid treasury vault");
        require(_agentRegistry != address(0), "Invalid agent registry");
        require(_messageBus != address(0), "Invalid message bus");

        treasuryVault = ITreasury(_treasuryVault);
        agentRegistry = IAgentRegistry(_agentRegistry);
        messageBus = IMessageBus(_messageBus);
    }

    function emergencyPause() external override onlyRole(GOVERNOR_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender);
    }

    function emergencyUnpause() external override onlyRole(GOVERNOR_ROLE) {
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }

    function setSlippageTolerance(uint256 newTolerance) external override onlyRole(GOVERNOR_ROLE) {
        require(newTolerance <= 1000, "Slippage tolerance too high"); // Cap at 10%
        
        pendingParameterUpdates["slippageTolerance"] = newTolerance;
        parameterUpdateTimestamps["slippageTolerance"] = block.number + parameterUpdateTimelock;
        
        emit ParameterUpdateScheduled("slippageTolerance", slippageTolerance, newTolerance, block.number + parameterUpdateTimelock);
    }

    function setTimelockDuration(uint256 newDuration) external override onlyRole(GOVERNOR_ROLE) {
        require(newDuration >= 2, "Timelock duration too short");
        
        pendingParameterUpdates["timelockDuration"] = newDuration;
        parameterUpdateTimestamps["timelockDuration"] = block.number + parameterUpdateTimelock;
        
        emit ParameterUpdateScheduled("timelockDuration", timelockDuration, newDuration, block.number + parameterUpdateTimelock);
    }

    function setAPYThreshold(uint256 newThreshold) external override onlyRole(GOVERNOR_ROLE) {
        require(newThreshold <= 10000, "APY threshold too high"); // Cap at 100%
        
        pendingParameterUpdates["apyThreshold"] = newThreshold;
        parameterUpdateTimestamps["apyThreshold"] = block.number + parameterUpdateTimelock;
        
        emit ParameterUpdateScheduled("apyThreshold", apyThreshold, newThreshold, block.number + parameterUpdateTimelock);
    }

    function setLargeMoveThreshold(uint256 newThreshold) external override onlyRole(GOVERNOR_ROLE) {
        require(newThreshold <= 5000, "Large move threshold too high"); // Cap at 50%
        
        pendingParameterUpdates["largeMoveThreshold"] = newThreshold;
        parameterUpdateTimestamps["largeMoveThreshold"] = block.number + parameterUpdateTimelock;
        
        emit ParameterUpdateScheduled("largeMoveThreshold", largeMoveThreshold, newThreshold, block.number + parameterUpdateTimelock);
    }

    function applyPendingUpdates() external onlyRole(GOVERNOR_ROLE) {
        if (parameterUpdateTimestamps["slippageTolerance"] != 0 && parameterUpdateTimestamps["slippageTolerance"] <= block.number) {
            uint256 oldValue = slippageTolerance;
            slippageTolerance = pendingParameterUpdates["slippageTolerance"];
            emit ParameterUpdated("slippageTolerance", oldValue, slippageTolerance, block.number);
            delete pendingParameterUpdates["slippageTolerance"];
            delete parameterUpdateTimestamps["slippageTolerance"];
        }
        
        if (parameterUpdateTimestamps["timelockDuration"] != 0 && parameterUpdateTimestamps["timelockDuration"] <= block.number) {
            uint256 oldValue = timelockDuration;
            timelockDuration = pendingParameterUpdates["timelockDuration"];
            emit ParameterUpdated("timelockDuration", oldValue, timelockDuration, block.number);
            delete pendingParameterUpdates["timelockDuration"];
            delete parameterUpdateTimestamps["timelockDuration"];
        }
        
        if (parameterUpdateTimestamps["apyThreshold"] != 0 && parameterUpdateTimestamps["apyThreshold"] <= block.number) {
            uint256 oldValue = apyThreshold;
            apyThreshold = pendingParameterUpdates["apyThreshold"];
            emit ParameterUpdated("apyThreshold", oldValue, apyThreshold, block.number);
            delete pendingParameterUpdates["apyThreshold"];
            delete parameterUpdateTimestamps["apyThreshold"];
        }
        
        if (parameterUpdateTimestamps["largeMoveThreshold"] != 0 && parameterUpdateTimestamps["largeMoveThreshold"] <= block.number) {
            uint256 oldValue = largeMoveThreshold;
            largeMoveThreshold = pendingParameterUpdates["largeMoveThreshold"];
            emit ParameterUpdated("largeMoveThreshold", oldValue, largeMoveThreshold, block.number);
            delete pendingParameterUpdates["largeMoveThreshold"];
            delete parameterUpdateTimestamps["largeMoveThreshold"];
        }
    }

    function getSlippageTolerance() external view override returns (uint256) {
        return slippageTolerance;
    }

    function getTimelockDuration() external view override returns (uint256) {
        return timelockDuration;
    }

    function getAPYThreshold() external view override returns (uint256) {
        return apyThreshold;
    }

    function getLargeMoveThreshold() external view override returns (uint256) {
        return largeMoveThreshold;
    }

    function isPaused() external view override returns (bool) {
        return paused();
    }

    function _pause() internal virtual override {
        super._pause();
    }

    function _unpause() internal virtual override {
        super._unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable) returns (bool) {
        return interfaceId == type(IGovernor).interfaceId || super.supportsInterface(interfaceId);
    }
}

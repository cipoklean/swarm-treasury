// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGovernor {
    function emergencyPause() external;

    function emergencyUnpause() external;

    function setSlippageTolerance(uint256 newTolerance) external;

    function setTimelockDuration(uint256 newDuration) external;

    function setAPYThreshold(uint256 newThreshold) external;

    function setLargeMoveThreshold(uint256 newThreshold) external;

    function getSlippageTolerance() external view returns (uint256);

    function getTimelockDuration() external view returns (uint256);

    function getAPYThreshold() external view returns (uint256);

    function getLargeMoveThreshold() external view returns (uint256);

    function isPaused() external view returns (bool);

    event EmergencyPause(address indexed caller);
    event EmergencyUnpause(address indexed caller);
    event ParameterUpdated(
        bytes32 indexed paramName,
        uint256 oldValue,
        uint256 newValue,
        uint256 effectiveBlock
    );
}

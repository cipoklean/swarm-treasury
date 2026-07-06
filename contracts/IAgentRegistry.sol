// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentRegistry {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getAgentRole(address agent) external view returns (uint8);
    function registerAgent(address agent, uint8 role) external;
    function unregisterAgent(address agent) external;
    function updateAgentRole(address agent, uint8 newRole) external;
    function getAgentsByRole(uint8 role) external view returns (address[] memory);
    function agentCount() external view returns (uint256);
    function isAgent(address agent) external view returns (bool);

    event AgentRegistered(address indexed agent, uint8 indexed role);
    event AgentUnregistered(address indexed agent, uint8 indexed role);
    event AgentRoleUpdated(address indexed agent, uint8 indexed oldRole, uint8 indexed newRole);
}
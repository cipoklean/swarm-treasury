// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IAgentRegistry} from "./IAgentRegistry.sol";

contract AgentRegistry is Initializable, AccessControlUpgradeable, IAgentRegistry {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant YIELD_SCOUT_ROLE = keccak256("YIELD_SCOUT_ROLE");
    bytes32 public constant RISK_GUARD_ROLE = keccak256("RISK_GUARD_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    uint8 public constant ROLE_YIELD_SCOUT = 1;
    uint8 public constant ROLE_RISK_GUARD = 2;
    uint8 public constant ROLE_EXECUTOR = 3;
    uint8 public constant ROLE_GOVERNOR = 4;

    mapping(address => uint8) public agentRole;
    mapping(uint8 => address[]) public agentsByRole;
    mapping(address => bool) public isRegistered;

    uint256 public agentCount;

    function initialize(address governor) external initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, governor);
        _grantRole(GOVERNOR_ROLE, governor);
    }

    function getAgentRole(address agent) external view override returns (uint8) {
        return agentRole[agent];
    }

    function hasRole(bytes32 role, address account) public view override(IAgentRegistry, AccessControlUpgradeable) returns (bool) {
        return super.hasRole(role, account);
    }

    function registerAgent(address agent, uint8 role) external override onlyRole(GOVERNOR_ROLE) {
        require(agent != address(0), "Invalid agent address");
        require(!isRegistered[agent], "Agent already registered");
        require(role >= ROLE_YIELD_SCOUT && role <= ROLE_GOVERNOR, "Invalid role");
        require(agentRole[agent] == 0, "Agent already has a role");

        bytes32 roleHash;
        if (role == ROLE_YIELD_SCOUT) {
            roleHash = YIELD_SCOUT_ROLE;
        } else if (role == ROLE_RISK_GUARD) {
            roleHash = RISK_GUARD_ROLE;
        } else if (role == ROLE_EXECUTOR) {
            roleHash = EXECUTOR_ROLE;
        } else if (role == ROLE_GOVERNOR) {
            roleHash = GOVERNOR_ROLE;
        } else {
            revert("Invalid role");
        }

        _grantRole(roleHash, agent);
        agentRole[agent] = role;
        agentsByRole[role].push(agent);
        isRegistered[agent] = true;
        agentCount++;

        emit AgentRegistered(agent, role);
    }

    function unregisterAgent(address agent) external override onlyRole(GOVERNOR_ROLE) {
        require(isRegistered[agent], "Agent not registered");

        uint8 role = agentRole[agent];
        require(role != 0, "Agent has no role");

        bytes32 roleHash;
        if (role == ROLE_YIELD_SCOUT) {
            roleHash = YIELD_SCOUT_ROLE;
        } else if (role == ROLE_RISK_GUARD) {
            roleHash = RISK_GUARD_ROLE;
        } else if (role == ROLE_EXECUTOR) {
            roleHash = EXECUTOR_ROLE;
        } else if (role == ROLE_GOVERNOR) {
            roleHash = GOVERNOR_ROLE;
        } else {
            revert("Invalid role");
        }

        _revokeRole(roleHash, agent);

        address[] storage roleAgents = agentsByRole[role];
        for (uint256 i = 0; i < roleAgents.length; i++) {
            if (roleAgents[i] == agent) {
                roleAgents[i] = roleAgents[roleAgents.length - 1];
                roleAgents.pop();
                break;
            }
        }

        agentRole[agent] = 0;
        isRegistered[agent] = false;
        agentCount--;

        emit AgentUnregistered(agent, role);
    }

    function updateAgentRole(address agent, uint8 newRole) external override onlyRole(GOVERNOR_ROLE) {
        require(isRegistered[agent], "Agent not registered");
        require(newRole >= ROLE_YIELD_SCOUT && newRole <= ROLE_GOVERNOR, "Invalid role");
        require(agentRole[agent] != newRole, "Same role");

        uint8 oldRole = agentRole[agent];
        require(oldRole != 0, "Agent has no role");

        bytes32 oldRoleHash;
        if (oldRole == ROLE_YIELD_SCOUT) {
            oldRoleHash = YIELD_SCOUT_ROLE;
        } else if (oldRole == ROLE_RISK_GUARD) {
            oldRoleHash = RISK_GUARD_ROLE;
        } else if (oldRole == ROLE_EXECUTOR) {
            oldRoleHash = EXECUTOR_ROLE;
        } else if (oldRole == ROLE_GOVERNOR) {
            oldRoleHash = GOVERNOR_ROLE;
        } else {
            revert("Invalid old role");
        }

        bytes32 newRoleHash;
        if (newRole == ROLE_YIELD_SCOUT) {
            newRoleHash = YIELD_SCOUT_ROLE;
        } else if (newRole == ROLE_RISK_GUARD) {
            newRoleHash = RISK_GUARD_ROLE;
        } else if (newRole == ROLE_EXECUTOR) {
            newRoleHash = EXECUTOR_ROLE;
        } else if (newRole == ROLE_GOVERNOR) {
            newRoleHash = GOVERNOR_ROLE;
        } else {
            revert("Invalid new role");
        }

        _revokeRole(oldRoleHash, agent);
        _grantRole(newRoleHash, agent);

        address[] storage oldRoleAgents = agentsByRole[oldRole];
        for (uint256 i = 0; i < oldRoleAgents.length; i++) {
            if (oldRoleAgents[i] == agent) {
                oldRoleAgents[i] = oldRoleAgents[oldRoleAgents.length - 1];
                oldRoleAgents.pop();
                break;
            }
        }

        agentsByRole[newRole].push(agent);
        agentRole[agent] = newRole;

        emit AgentRoleUpdated(agent, oldRole, newRole);
    }

    function getAgentsByRole(uint8 role) external view override returns (address[] memory) {
        require(role >= ROLE_YIELD_SCOUT && role <= ROLE_GOVERNOR, "Invalid role");
        return agentsByRole[role];
    }

    function isAgent(address agent) external view override returns (bool) {
        return isRegistered[agent];
    }

    function _revokeRole(bytes32 role, address account) internal virtual override {
        super._revokeRole(role, account);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable) returns (bool) {
        return interfaceId == type(IAgentRegistry).interfaceId || super.supportsInterface(interfaceId);
    }
}
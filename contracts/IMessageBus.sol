// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMessageBus {
    struct Message {
        uint256 proposalId;
        uint8 agentRole;
        uint8 messageType;
        uint256 blockNumber;
        bytes32 dataHash;
        uint256 timestamp;
        bool isActive;
    }

    function postMessage(
        uint256 proposalId,
        uint8 agentRole,
        uint8 messageType,
        uint256 blockNumber,
        bytes32 dataHash
    ) external returns (uint256);

    function getMessage(uint256 messageId) external view returns (Message memory);

    function getMessagesByProposal(uint256 proposalId) external view returns (Message[] memory);

    function getMessageCount() external view returns (uint256);

    function getMessagesByAgent(uint8 agentRole) external view returns (Message[] memory);

    function messageExists(uint256 messageId) external view returns (bool);

    event MessagePosted(
        uint256 indexed messageId,
        uint256 indexed proposalId,
        uint8 agentRole,
        uint8 messageType,
        uint256 blockNumber,
        bytes32 dataHash
    );

    event MessageExpired(uint256 indexed messageId, uint256 indexed proposalId);
}

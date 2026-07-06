// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IMessageBus} from "./IMessageBus.sol";

contract MessageBus is Initializable, OwnableUpgradeable, IMessageBus {
    uint256 public messageCount;
    mapping(uint256 => Message) public messages;
    mapping(uint256 => uint256[]) public messagesByProposal;
    mapping(uint8 => uint256[]) public messagesByAgent;
    mapping(uint256 => bool) public messageExistsMap;

    uint256 public constant MESSAGE_EXPIRY_BLOCKS = 10;

    function initialize() external initializer {
        __Ownable_init();
    }

    function postMessage(
        uint256 proposalId,
        uint8 agentRole,
        uint8 messageType,
        uint256 blockNumber,
        bytes32 dataHash
    ) external override returns (uint256) {
        require(agentRole >= 1 && agentRole <= 4, "Invalid agent role");
        require(messageType >= 0 && messageType <= 2, "Invalid message type");

        messageCount++;
        uint256 messageId = messageCount;

        messages[messageId] = Message({
            proposalId: proposalId,
            agentRole: agentRole,
            messageType: messageType,
            blockNumber: blockNumber,
            dataHash: dataHash,
            timestamp: block.timestamp,
            isActive: true
        });

        messagesByProposal[proposalId].push(messageId);
        messagesByAgent[agentRole].push(messageId);
        messageExistsMap[messageId] = true;

        emit MessagePosted(messageId, proposalId, agentRole, messageType, blockNumber, dataHash);

        return messageId;
    }

    function getMessage(uint256 messageId) external view override returns (Message memory) {
        require(messageExistsMap[messageId], "Message does not exist");
        return messages[messageId];
    }

    function getMessagesByProposal(uint256 proposalId) external view override returns (Message[] memory) {
        uint256[] memory messageIds = messagesByProposal[proposalId];
        Message[] memory result = new Message[](messageIds.length);
        for (uint256 i = 0; i < messageIds.length; i++) {
            result[i] = messages[messageIds[i]];
        }
        return result;
    }

    function getMessageCount() external view override returns (uint256) {
        return messageCount;
    }

    function getMessagesByAgent(uint8 agentRole) external view override returns (Message[] memory) {
        require(agentRole >= 1 && agentRole <= 4, "Invalid agent role");
        uint256[] memory messageIds = messagesByAgent[agentRole];
        Message[] memory result = new Message[](messageIds.length);
        for (uint256 i = 0; i < messageIds.length; i++) {
            result[i] = messages[messageIds[i]];
        }
        return result;
    }

    function messageExists(uint256 messageId) external view override returns (bool) {
        return messageExistsMap[messageId];
    }

    function checkExpiry(uint256 messageId) external returns (bool) {
        Message memory messageData = messages[messageId];
        if (block.number > messageData.blockNumber + MESSAGE_EXPIRY_BLOCKS) {
            messageExistsMap[messageId] = false;
            emit MessageExpired(messageId, messageData.proposalId);
            return true;
        }
        return false;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IMessageBus).interfaceId;
    }
}

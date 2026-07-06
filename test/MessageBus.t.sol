// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MessageBus} from "../contracts/MessageBus.sol";
import {IMessageBus} from "../contracts/IMessageBus.sol";

contract MessageBusTest is Test {
    MessageBus public bus;

    uint256 constant PROPOSAL_ID = 1;
    uint8 constant AGENT_ROLE = 1; // Yield Scout
    uint8 constant MSG_TYPE = 0; // Proposal

    function setUp() public {
        bus = new MessageBus();
        bus.initialize();
    }

    // ==================== postMessage ====================

    function test_PostMessage() public {
        uint256 msgId = bus.postMessage(PROPOSAL_ID, AGENT_ROLE, MSG_TYPE, block.number, bytes32("data"));

        assertEq(msgId, 1);
        assertEq(bus.getMessageCount(), 1);
        assertTrue(bus.messageExists(msgId));

        IMessageBus.Message memory m = bus.getMessage(msgId);
        assertEq(m.proposalId, PROPOSAL_ID);
        assertEq(m.agentRole, AGENT_ROLE);
        assertEq(m.messageType, MSG_TYPE);
        assertEq(m.blockNumber, block.number);
        assertEq(m.dataHash, bytes32("data"));
        assertTrue(m.isActive);
    }

    function test_PostMessage_IncrementsCount() public {
        bus.postMessage(1, 1, 0, block.number, bytes32("a"));
        bus.postMessage(2, 2, 1, block.number, bytes32("b"));
        bus.postMessage(3, 3, 2, block.number, bytes32("c"));

        assertEq(bus.getMessageCount(), 3);
    }

    function test_PostMessage_ByRole() public {
        bus.postMessage(PROPOSAL_ID, 1, MSG_TYPE, block.number, bytes32("d1"));
        bus.postMessage(PROPOSAL_ID, 2, MSG_TYPE, block.number, bytes32("d2"));

        // Get messages by agent role
        IMessageBus.Message[] memory m1 = bus.getMessagesByAgent(1);
        assertEq(m1.length, 1);
        assertEq(m1[0].agentRole, 1);

        IMessageBus.Message[] memory m2 = bus.getMessagesByAgent(2);
        assertEq(m2.length, 1);
        assertEq(m2[0].agentRole, 2);
    }

    function test_RevertPost_InvalidRole() public {
        vm.expectRevert("Invalid agent role");
        bus.postMessage(PROPOSAL_ID, 5, MSG_TYPE, block.number, bytes32("data"));
    }

    // ==================== getMessage ====================

    function test_GetMessage_NotFound() public {
        vm.expectRevert("Message does not exist");
        bus.getMessage(999);
    }

    // ==================== getMessagesByProposal ====================

    function test_GetMessagesByProposal() public {
        bus.postMessage(1, 1, 0, block.number, bytes32("a"));
        bus.postMessage(1, 2, 1, block.number, bytes32("b"));
        bus.postMessage(2, 1, 0, block.number, bytes32("c"));

        IMessageBus.Message[] memory msgs = bus.getMessagesByProposal(1);
        assertEq(msgs.length, 2);

        IMessageBus.Message[] memory empty = bus.getMessagesByProposal(99);
        assertEq(empty.length, 0);
    }

    // ==================== messageExists ====================

    function test_MessageExists_False() public {
        assertFalse(bus.messageExists(999));
    }

    // ==================== checkExpiry ====================

    function test_CheckExpiry_NotExpired() public {
        uint256 msgId = bus.postMessage(PROPOSAL_ID, AGENT_ROLE, MSG_TYPE, block.number, bytes32("data"));

        // Message just posted, shouldn't be expired
        assertFalse(bus.checkExpiry(msgId));
        assertTrue(bus.messageExists(msgId));
    }

    function test_CheckExpiry_Expired() public {
        uint256 msgId = bus.postMessage(PROPOSAL_ID, AGENT_ROLE, MSG_TYPE, block.number, bytes32("data"));

        // Warp past expiry (MESSAGE_EXPIRY_BLOCKS = 10)
        vm.roll(block.number + 15);
        assertTrue(bus.checkExpiry(msgId));
        assertFalse(bus.messageExists(msgId));
    }

    // ==================== supportsInterface ====================

    function test_SupportsInterface() public {
        assertTrue(bus.supportsInterface(type(IMessageBus).interfaceId));
    }
}

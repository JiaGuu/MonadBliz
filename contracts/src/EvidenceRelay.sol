// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Attests to a specific version of an evidence package. Files stay off chain.
contract EvidenceRelay {
    struct Handover {
        address sender;
        address recipient;
        bytes32 digest;
        bool accepted;
    }

    mapping(bytes32 => Handover) private handovers;

    event Opened(bytes32 indexed id, address indexed sender, address indexed recipient, bytes32 digest);
    event Accepted(bytes32 indexed id, address indexed recipient, bytes32 digest);

    error InvalidHandover();
    error AlreadyOpened();
    error AlreadyAccepted();
    error WrongRecipient();
    error DigestMismatch();

    function openHandover(bytes32 digest, address recipient, bytes32 salt) external returns (bytes32 id) {
        if (digest == bytes32(0) || recipient == address(0) || recipient == msg.sender) revert InvalidHandover();
        id = keccak256(abi.encode(msg.sender, recipient, digest, salt));
        if (handovers[id].sender != address(0)) revert AlreadyOpened();
        handovers[id] = Handover(msg.sender, recipient, digest, false);
        emit Opened(id, msg.sender, recipient, digest);
    }

    function getHandover(bytes32 id) external view returns (Handover memory) {
        return handovers[id];
    }

    function acceptHandover(bytes32 id, bytes32 digest) external {
        Handover storage handover = handovers[id];
        if (handover.sender == address(0)) revert InvalidHandover();
        if (handover.recipient != msg.sender) revert WrongRecipient();
        if (handover.accepted) revert AlreadyAccepted();
        if (handover.digest != digest) revert DigestMismatch();
        handover.accepted = true;
        emit Accepted(id, msg.sender, digest);
    }
}

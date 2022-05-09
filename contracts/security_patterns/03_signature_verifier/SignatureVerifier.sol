// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title SignatureVerifier
/// @notice Verifies an off-chain ECDSA signature over (to, amount, nonce).
/// @dev Uses the Ethereum Signed Message prefix ("\x19Ethereum Signed Message:\n32").
contract SignatureVerifier {
    using ECDSA for bytes32;

    /// @notice Hash the (to, amount, nonce) tuple the signer endorsed.
    function getMessageHash(address to, uint256 amount, string memory nonce) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(to, amount, nonce));
    }

    /// @notice Apply the Ethereum Signed Message prefix to a 32-byte hash.
    function getEthSignedMessageHash(bytes32 messageHash) public pure returns (bytes32) {
        return messageHash.toEthSignedMessageHash();
    }

    /// @notice Recover the signer of `sig` and compare to `signer`.
    function verify(
        address signer,
        address to,
        uint256 amount,
        string memory nonce,
        bytes memory sig
    ) public pure returns (bool) {
        bytes32 messageHash = getMessageHash(to, amount, nonce);
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);
        return ethSignedMessageHash.recover(sig) == signer;
    }
}

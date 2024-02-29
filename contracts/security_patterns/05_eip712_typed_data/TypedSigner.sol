// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title TypedSigner
/// @notice Verifies off-chain EIP-712 signed orders. Tracks per-maker nonces
///         to prevent replay.
contract TypedSigner is EIP712 {
    using ECDSA for bytes32;

    struct Order {
        address maker;
        address token;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 public constant ORDER_TYPEHASH =
        keccak256("Order(address maker,address token,uint256 amount,uint256 nonce,uint256 deadline)");

    /// @dev usedNonces[maker][nonce] = true once consumed.
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    constructor() EIP712("TypedSigner", "1") {}

    function hashOrder(Order calldata order) public pure returns (bytes32) {
        return
            keccak256(abi.encode(ORDER_TYPEHASH, order.maker, order.token, order.amount, order.nonce, order.deadline));
    }

    /// @notice Returns the EIP-712 digest for the given order under this contract's domain.
    function digest(Order calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(hashOrder(order));
    }

    /// @notice Verify a signed order without consuming the nonce.
    function verify(Order calldata order, bytes calldata signature) public view returns (bool) {
        if (block.timestamp > order.deadline) return false;
        if (usedNonces[order.maker][order.nonce]) return false;
        address recovered = digest(order).recover(signature);
        return recovered == order.maker;
    }

    /// @notice Verify and consume the nonce so it cannot be replayed.
    function execute(Order calldata order, bytes calldata signature) external {
        require(block.timestamp <= order.deadline, "expired");
        require(!usedNonces[order.maker][order.nonce], "nonce used");
        address recovered = digest(order).recover(signature);
        require(recovered == order.maker, "bad signer");
        usedNonces[order.maker][order.nonce] = true;
    }
}

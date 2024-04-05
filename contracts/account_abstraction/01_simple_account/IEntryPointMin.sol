// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title IEntryPointMin
/// @notice Minimal ERC-4337-flavored entry point interface used for educational examples.
interface IEntryPointMin {
    struct UserOp {
        address sender;
        uint256 nonce;
        bytes callData;
        uint256 callGasLimit;
    }

    function handleOp(UserOp calldata op, bytes calldata signature) external;
}

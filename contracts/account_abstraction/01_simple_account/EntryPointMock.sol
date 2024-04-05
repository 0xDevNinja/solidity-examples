// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IEntryPointMin.sol";

interface ISimpleAccount {
    function validateUserOp(bytes32 opHash, bytes calldata signature) external returns (uint256);

    function execute(address to, uint256 value, bytes calldata data) external;
}

/// @title EntryPointMock
/// @notice Educational stand-in for the ERC-4337 EntryPoint. Computes the op
///         hash, asks the account to validate, then executes the call.
contract EntryPointMock is IEntryPointMin {
    event OpHandled(address indexed sender, bytes32 opHash);

    /// @notice Hash the UserOp deterministically together with this entry point
    ///         and the current chainId so signatures cannot be replayed across
    ///         entry points or chains.
    function getOpHash(UserOp calldata op) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(op.sender, op.nonce, keccak256(op.callData), op.callGasLimit, address(this), block.chainid)
            );
    }

    function handleOp(UserOp calldata op, bytes calldata signature) external override {
        bytes32 opHash = getOpHash(op);
        uint256 valid = ISimpleAccount(op.sender).validateUserOp(opHash, signature);
        require(valid == 0, "invalid signature");

        // Decode callData as (address to, uint256 value, bytes data) and forward.
        (address to, uint256 value, bytes memory data) = abi.decode(op.callData, (address, uint256, bytes));
        ISimpleAccount(op.sender).execute(to, value, data);

        emit OpHandled(op.sender, opHash);
    }
}

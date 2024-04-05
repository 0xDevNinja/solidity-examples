// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IEntryPointMin.sol";

/// @title SimpleAccount
/// @notice Educational simplified ERC-4337-style smart account. Owner-controlled,
///         validated and executed via a trusted EntryPoint.
contract SimpleAccount {
    using ECDSA for bytes32;

    address public immutable owner;
    address public immutable entryPoint;
    uint256 public nonce;

    event Executed(address indexed to, uint256 value, bytes data);

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "only entry point");
        _;
    }

    constructor(address owner_, address entryPoint_) {
        owner = owner_;
        entryPoint = entryPoint_;
    }

    receive() external payable {}

    /// @notice Validate a UserOp signature. Returns 0 on success (ERC-4337 style),
    ///         1 on failure. Increments nonce on success.
    function validateUserOp(bytes32 opHash, bytes calldata signature) external onlyEntryPoint returns (uint256) {
        bytes32 ethHash = opHash.toEthSignedMessageHash();
        address recovered = ethHash.recover(signature);
        if (recovered != owner) {
            return 1;
        }
        nonce += 1;
        return 0;
    }

    /// @notice Execute a single call. Only callable by the EntryPoint.
    function execute(address to, uint256 value, bytes calldata data) external onlyEntryPoint {
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        if (!ok) {
            // Bubble up the revert reason if any.
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        emit Executed(to, value, data);
    }
}

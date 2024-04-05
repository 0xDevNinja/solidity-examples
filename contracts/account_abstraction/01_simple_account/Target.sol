// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title Target
/// @notice Tiny test target used to verify AA execute() routes calls correctly.
contract Target {
    uint256 public value;
    address public lastCaller;

    function setValue(uint256 v) external payable {
        value = v;
        lastCaller = msg.sender;
    }
}

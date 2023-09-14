// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title GovernedBox
/// @notice Trivial target whose state is mutated only by the configured governor (timelock).
contract GovernedBox {
    uint256 public value;
    address public immutable governor;

    event ValueChanged(uint256 newValue);

    constructor(address governor_) {
        governor = governor_;
    }

    function setValue(uint256 newValue) external {
        require(msg.sender == governor, "GovernedBox: only governor");
        value = newValue;
        emit ValueChanged(newValue);
    }
}

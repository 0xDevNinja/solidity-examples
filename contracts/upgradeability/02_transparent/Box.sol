// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title Box
/// @notice Trivial storage contract used behind a transparent proxy.
contract Box {
    uint256 private _value;

    event ValueChanged(uint256 newValue);

    function store(uint256 newValue) public {
        _value = newValue;
        emit ValueChanged(newValue);
    }

    function retrieve() public view returns (uint256) {
        return _value;
    }
}

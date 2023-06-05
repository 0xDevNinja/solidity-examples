// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title BoxV2
/// @notice Box V1 storage layout preserved; adds increment().
contract BoxV2 {
    uint256 private _value;

    event ValueChanged(uint256 newValue);

    function store(uint256 newValue) public {
        _value = newValue;
        emit ValueChanged(newValue);
    }

    function retrieve() public view returns (uint256) {
        return _value;
    }

    function increment() public {
        _value += 1;
        emit ValueChanged(_value);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title CounterV1
/// @notice First version of an upgradeable counter using the UUPS pattern.
/// @dev Storage layout: slot 0 = owner, slot 1 = count. Children must preserve this.
contract CounterV1 is Initializable, UUPSUpgradeable {
    address public owner;
    uint256 public count;

    event Incremented(uint256 newValue);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        owner = msg.sender;
    }

    function increment() external {
        count += 1;
        emit Incremented(count);
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        require(msg.sender == owner, "CounterV1: only owner");
        // silence unused-variable warning
        newImplementation;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title CounterV2
/// @notice Adds decrement(). Preserves the V1 storage layout exactly:
///         slot 0 = owner, slot 1 = count. Any new state must be appended.
contract CounterV2 is Initializable, UUPSUpgradeable {
    // --- V1 storage (DO NOT change order or types) ---
    address public owner;
    uint256 public count;
    // --- end V1 storage ---

    event Incremented(uint256 newValue);
    event Decremented(uint256 newValue);

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

    function decrement() external {
        require(count > 0, "CounterV2: underflow");
        count -= 1;
        emit Decremented(count);
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        require(msg.sender == owner, "CounterV2: only owner");
        newImplementation;
    }
}

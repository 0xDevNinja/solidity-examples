// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title IDiamond
/// @notice Minimal interface for an EIP-2535 educational diamond.
interface IDiamond {
    /// @notice Emitted when a facet's selectors are registered.
    event FacetAdded(address indexed facet, bytes4[] selectors);

    /// @notice Register `selectors` to be served by `facet` via delegatecall.
    function addFacet(address facet, bytes4[] calldata selectors) external;
}

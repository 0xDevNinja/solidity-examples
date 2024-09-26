// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title ExampleFacet
/// @notice Trivial facet demonstrating the diamond-storage pattern. Each facet
///         picks a deterministic, collision-resistant slot for its state
///         (`keccak256("example.facet.x")`) so storage layouts of unrelated
///         facets never overlap with each other or the diamond's own slots.
contract ExampleFacet {
    /// @dev Fixed storage slot for `x`. Keep this far from slots 0/1 used by
    ///      the diamond (`owner`, `facets`).
    bytes32 internal constant SLOT = keccak256("example.facet.x");

    function setX(uint256 v) external {
        bytes32 slot = SLOT;
        assembly {
            sstore(slot, v)
        }
    }

    function getX() external view returns (uint256 v) {
        bytes32 slot = SLOT;
        assembly {
            v := sload(slot)
        }
    }
}

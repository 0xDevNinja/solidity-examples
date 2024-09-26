// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IDiamond.sol";

/// @title Diamond
/// @notice Minimal EIP-2535 diamond for educational purposes. Routes calls to
///         facet contracts by selector via `delegatecall`. Real diamonds use
///         the `IDiamondCut` / `IDiamondLoupe` interfaces and store facet data
///         using the diamond-storage pattern; this contract is intentionally
///         simplified to highlight only the essentials.
contract Diamond is IDiamond {
    /// @notice Slot 0: contract owner, the only address that may register facets.
    address public owner;

    /// @notice Slot 1: selector to facet implementation address.
    mapping(bytes4 => address) public facets;

    constructor() {
        owner = msg.sender;
    }

    /// @inheritdoc IDiamond
    function addFacet(address facet, bytes4[] calldata selectors) external {
        require(msg.sender == owner, "Diamond: only owner");
        require(facet != address(0), "Diamond: zero facet");
        for (uint256 i = 0; i < selectors.length; i++) {
            facets[selectors[i]] = facet;
        }
        emit FacetAdded(facet, selectors);
    }

    /// @notice Look up the facet for the called selector and `delegatecall` it.
    fallback() external payable {
        address facet = facets[msg.sig];
        require(facet != address(0), "Diamond: function does not exist");
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {}
}

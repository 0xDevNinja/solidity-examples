// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

/// @title PermitToken
/// @notice ERC20 with EIP-2612 permit() for gasless approvals via signed messages.
contract PermitToken is ERC20, ERC20Permit {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC20Permit(name_) {}

    /// @notice Open mint for testing convenience.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

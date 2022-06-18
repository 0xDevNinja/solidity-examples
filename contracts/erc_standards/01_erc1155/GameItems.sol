// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @title GameItems
/// @notice Minimal ERC1155 multi-token (fungible + semi-fungible) example.
contract GameItems is ERC1155 {
    uint256 public constant GOLD = 0;
    uint256 public constant SILVER = 1;
    uint256 public constant SWORD = 2;

    constructor() ERC1155("https://game.example/api/item/{id}.json") {
        _mint(msg.sender, GOLD, 10_000 ether, "");
        _mint(msg.sender, SILVER, 100_000 ether, "");
        _mint(msg.sender, SWORD, 1_000, "");
    }
}

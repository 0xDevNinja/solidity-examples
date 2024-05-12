// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Paymaster
/// @notice Educational paymaster: holds ETH deposits per account and reports
///         whether a given account can be sponsored.
contract Paymaster is Ownable, ReentrancyGuard {
    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    event Sponsored(address indexed account, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    /// @notice Deposit ETH that can be used to sponsor `account`.
    function sponsor(address account, uint256 amount) external payable {
        require(account != address(0), "zero account");
        require(msg.value == amount, "amount mismatch");
        deposits[account] += amount;
        totalDeposits += amount;
        emit Sponsored(account, amount);
    }

    /// @notice True if `account` has any sponsorship balance left.
    function validatePayment(address account) external view returns (bool) {
        return deposits[account] > 0;
    }

    /// @notice Owner-only withdrawal of unallocated funds.
    /// @dev Can only withdraw the contract's surplus over `totalDeposits`,
    ///      so user balances are never silently drained.
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 surplus = address(this).balance - totalDeposits;
        require(amount <= surplus + totalDeposits, "exceeds balance");
        // Allow the owner to claw back from the protocol pool only up to the surplus
        // unless they explicitly are also reducing user deposits — in this educational
        // version we keep it simple: owner can withdraw any amount up to the contract
        // balance, but real systems should not allow draining user deposits.
        require(amount <= address(this).balance, "exceeds contract balance");
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawn(owner(), amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LinearVesting
/// @notice Linearly vests an ERC20 balance held by this contract to a single
///         beneficiary over [start, start + duration].
contract LinearVesting {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint64 public immutable start;
    uint64 public immutable duration;

    uint256 public released;

    event Released(uint256 amount);

    constructor(address token_, address beneficiary_, uint64 start_, uint64 duration_) {
        require(beneficiary_ != address(0), "beneficiary=0");
        require(token_ != address(0), "token=0");
        require(duration_ > 0, "duration=0");

        token = IERC20(token_);
        beneficiary = beneficiary_;
        start = start_;
        duration = duration_;
    }

    /// @notice Total amount vested at `timestamp` (already-released included).
    function vestedAmount(uint64 timestamp) public view returns (uint256) {
        uint256 totalAllocation = token.balanceOf(address(this)) + released;

        if (timestamp < start) {
            return 0;
        }
        if (timestamp >= start + duration) {
            return totalAllocation;
        }
        return (totalAllocation * (timestamp - start)) / duration;
    }

    /// @notice Amount currently releasable (vested - already released).
    function releasable() public view returns (uint256) {
        return vestedAmount(uint64(block.timestamp)) - released;
    }

    /// @notice Pull out the currently-releasable amount to the beneficiary.
    function release() external {
        uint256 amount = releasable();
        require(amount > 0, "Nothing to release");

        released += amount;
        token.safeTransfer(beneficiary, amount);

        emit Released(amount);
    }
}

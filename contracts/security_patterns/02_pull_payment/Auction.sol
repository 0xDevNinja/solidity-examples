// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Auction {
    address public highestBidder;
    uint256 public highestBid;

    mapping(address => uint256) public pendingReturns;

    event NewHighBid(address indexed bidder, uint256 amount);
    event Withdrawn(address indexed bidder, uint256 amount);

    function bid() external payable {
        require(msg.value > highestBid, "Bid too low");

        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = msg.value;
        emit NewHighBid(msg.sender, msg.value);
    }

    function withdraw() external returns (bool) {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingReturns[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) {
            pendingReturns[msg.sender] = amount;
            return false;
        }
        emit Withdrawn(msg.sender, amount);
        return true;
    }
}

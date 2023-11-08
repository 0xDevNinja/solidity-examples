// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title Crowdfunding
/// @notice Kickstarter-style ETH escrow. Per-campaign goal + deadline; pledgers refund on failure.
contract Crowdfunding {
    struct Campaign {
        address creator;
        uint256 goal;
        uint256 deadline; // unix timestamp
        uint256 pledged;
        bool claimed;
    }

    Campaign[] private _campaigns;

    /// @dev campaignId => pledger => amount
    mapping(uint256 => mapping(address => uint256)) public pledgedAmount;

    event CampaignCreated(uint256 indexed id, address indexed creator, uint256 goal, uint256 deadline);
    event Pledged(uint256 indexed id, address indexed pledger, uint256 amount);
    event Claimed(uint256 indexed id, address indexed creator, uint256 amount);
    event Refunded(uint256 indexed id, address indexed pledger, uint256 amount);

    function campaignCount() external view returns (uint256) {
        return _campaigns.length;
    }

    function getCampaign(
        uint256 id
    ) external view returns (address creator, uint256 goal, uint256 deadline, uint256 pledged, bool claimed) {
        Campaign storage c = _campaigns[id];
        return (c.creator, c.goal, c.deadline, c.pledged, c.claimed);
    }

    function createCampaign(uint256 goal, uint256 deadline) external returns (uint256 id) {
        require(goal > 0, "Crowdfunding: goal=0");
        require(deadline > block.timestamp, "Crowdfunding: deadline in past");

        id = _campaigns.length;
        _campaigns.push(Campaign({creator: msg.sender, goal: goal, deadline: deadline, pledged: 0, claimed: false}));
        emit CampaignCreated(id, msg.sender, goal, deadline);
    }

    function pledge(uint256 id) external payable {
        Campaign storage c = _campaigns[id];
        require(block.timestamp < c.deadline, "Crowdfunding: campaign ended");
        require(msg.value > 0, "Crowdfunding: zero pledge");

        c.pledged += msg.value;
        pledgedAmount[id][msg.sender] += msg.value;
        emit Pledged(id, msg.sender, msg.value);
    }

    function claim(uint256 id) external {
        Campaign storage c = _campaigns[id];
        require(msg.sender == c.creator, "Crowdfunding: only creator");
        require(block.timestamp >= c.deadline, "Crowdfunding: not ended");
        require(c.pledged >= c.goal, "Crowdfunding: goal not met");
        require(!c.claimed, "Crowdfunding: already claimed");

        c.claimed = true;
        uint256 amount = c.pledged;
        (bool ok, ) = c.creator.call{value: amount}("");
        require(ok, "Crowdfunding: transfer failed");
        emit Claimed(id, c.creator, amount);
    }

    function refund(uint256 id) external {
        Campaign storage c = _campaigns[id];
        require(block.timestamp >= c.deadline, "Crowdfunding: not ended");
        require(c.pledged < c.goal, "Crowdfunding: goal met");

        uint256 amount = pledgedAmount[id][msg.sender];
        require(amount > 0, "Crowdfunding: nothing to refund");

        pledgedAmount[id][msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Crowdfunding: transfer failed");
        emit Refunded(id, msg.sender, amount);
    }
}

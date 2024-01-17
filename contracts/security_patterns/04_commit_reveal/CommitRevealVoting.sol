// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title CommitRevealVoting
/// @notice Two-phase voting that prevents front-running by committing a hash
///         during phase one and revealing the underlying vote during phase two.
contract CommitRevealVoting {
    uint256 public immutable commitDeadline;
    uint256 public immutable revealDeadline;

    mapping(address => bytes32) public commits;
    mapping(address => bool) public revealed;

    uint256 public votesFor; // option 1
    uint256 public votesAgainst; // option 0

    event Committed(address indexed voter, bytes32 commitHash);
    event Revealed(address indexed voter, uint256 vote);

    constructor(uint256 commitDuration, uint256 revealDuration) {
        commitDeadline = block.timestamp + commitDuration;
        revealDeadline = commitDeadline + revealDuration;
    }

    /// @notice Commit a hash of (vote, salt, msg.sender) during the commit phase.
    function commit(bytes32 hash) external {
        require(block.timestamp <= commitDeadline, "commit phase ended");
        require(commits[msg.sender] == bytes32(0), "already committed");
        commits[msg.sender] = hash;
        emit Committed(msg.sender, hash);
    }

    /// @notice Reveal during reveal phase. Must match the prior commitment.
    function reveal(uint256 vote, bytes32 salt) external {
        require(block.timestamp > commitDeadline, "reveal phase not started");
        require(block.timestamp <= revealDeadline, "reveal phase ended");
        require(!revealed[msg.sender], "already revealed");
        bytes32 expected = commits[msg.sender];
        require(expected != bytes32(0), "no commit");
        require(keccak256(abi.encodePacked(vote, salt, msg.sender)) == expected, "bad reveal");
        require(vote == 0 || vote == 1, "invalid option");

        revealed[msg.sender] = true;
        if (vote == 1) {
            votesFor += 1;
        } else {
            votesAgainst += 1;
        }
        emit Revealed(msg.sender, vote);
    }

    function tally() external view returns (uint256 forVotes, uint256 againstVotes) {
        return (votesFor, votesAgainst);
    }
}

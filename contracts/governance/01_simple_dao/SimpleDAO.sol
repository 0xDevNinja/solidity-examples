// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title GovToken
/// @notice Minimal ERC20 used as governance weight in SimpleDAO tests.
contract GovToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("GovToken", "GOV") {
        _mint(msg.sender, initialSupply);
    }
}

/// @title Treasury
/// @notice Trivial target contract whose state is changed by DAO execution.
contract Treasury {
    string public message;
    address public dao;

    event MessageSet(string newMessage);

    constructor(address dao_) {
        dao = dao_;
    }

    function setMessage(string calldata newMessage) external {
        require(msg.sender == dao, "Treasury: only DAO");
        message = newMessage;
        emit MessageSet(newMessage);
    }
}

/// @title SimpleDAO
/// @notice Token-weighted proposal/vote/execute DAO. No timelock, no Governor.
contract SimpleDAO {
    uint256 public constant VOTING_PERIOD = 3 days;

    IERC20 public immutable token;

    struct Proposal {
        address proposer;
        address target;
        bytes data;
        string description;
        uint256 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
    }

    Proposal[] private _proposals;

    /// @dev proposalId => voter => has voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address indexed target,
        string description,
        uint256 deadline
    );
    event Voted(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event Executed(uint256 indexed id, bytes returnData);

    constructor(IERC20 token_) {
        require(address(token_) != address(0), "SimpleDAO: token=0");
        token = token_;
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(
        uint256 id
    )
        external
        view
        returns (
            address proposer,
            address target,
            string memory description,
            uint256 deadline,
            uint256 forVotes,
            uint256 againstVotes,
            bool executed
        )
    {
        Proposal storage p = _proposals[id];
        return (p.proposer, p.target, p.description, p.deadline, p.forVotes, p.againstVotes, p.executed);
    }

    function propose(string calldata description, address target, bytes calldata data) external returns (uint256 id) {
        require(target != address(0), "SimpleDAO: target=0");
        id = _proposals.length;
        _proposals.push(
            Proposal({
                proposer: msg.sender,
                target: target,
                data: data,
                description: description,
                deadline: block.timestamp + VOTING_PERIOD,
                forVotes: 0,
                againstVotes: 0,
                executed: false
            })
        );
        emit ProposalCreated(id, msg.sender, target, description, block.timestamp + VOTING_PERIOD);
    }

    function vote(uint256 id, bool support) external {
        Proposal storage p = _proposals[id];
        require(block.timestamp <= p.deadline, "SimpleDAO: voting closed");
        require(!hasVoted[id][msg.sender], "SimpleDAO: already voted");

        uint256 weight = token.balanceOf(msg.sender);
        require(weight > 0, "SimpleDAO: no voting power");

        hasVoted[id][msg.sender] = true;
        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }
        emit Voted(id, msg.sender, support, weight);
    }

    function execute(uint256 id) external returns (bytes memory) {
        Proposal storage p = _proposals[id];
        require(block.timestamp > p.deadline, "SimpleDAO: voting open");
        require(!p.executed, "SimpleDAO: already executed");
        require(p.forVotes > p.againstVotes, "SimpleDAO: not passed");

        p.executed = true;
        (bool ok, bytes memory ret) = p.target.call(p.data);
        require(ok, "SimpleDAO: call failed");
        emit Executed(id, ret);
        return ret;
    }
}

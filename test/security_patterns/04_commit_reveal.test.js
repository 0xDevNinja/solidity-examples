const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security Patterns / Commit Reveal Voting", function () {
  let voting, alice, bob, carol;
  const COMMIT = 100; // seconds
  const REVEAL = 100;

  function commitHash(vote, salt, voter) {
    return ethers.utils.solidityKeccak256(
      ["uint256", "bytes32", "address"],
      [vote, salt, voter]
    );
  }

  beforeEach(async () => {
    [alice, bob, carol] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/security_patterns/04_commit_reveal/CommitRevealVoting.sol:CommitRevealVoting"
    );
    voting = await F.deploy(COMMIT, REVEAL);
    await voting.deployed();
  });

  it("Tallies votes after commit and reveal", async () => {
    const saltA = ethers.utils.formatBytes32String("salt-a");
    const saltB = ethers.utils.formatBytes32String("salt-b");
    const saltC = ethers.utils.formatBytes32String("salt-c");

    await voting.connect(alice).commit(commitHash(1, saltA, alice.address));
    await voting.connect(bob).commit(commitHash(1, saltB, bob.address));
    await voting.connect(carol).commit(commitHash(0, saltC, carol.address));

    // Move past commit deadline.
    await ethers.provider.send("evm_increaseTime", [COMMIT + 1]);
    await ethers.provider.send("evm_mine", []);

    await voting.connect(alice).reveal(1, saltA);
    await voting.connect(bob).reveal(1, saltB);
    await voting.connect(carol).reveal(0, saltC);

    const [forVotes, againstVotes] = await voting.tally();
    expect(forVotes).to.equal(2);
    expect(againstVotes).to.equal(1);
  });

  it("Reverts reveal with wrong salt", async () => {
    const salt = ethers.utils.formatBytes32String("real-salt");
    const wrongSalt = ethers.utils.formatBytes32String("wrong");

    await voting.connect(alice).commit(commitHash(1, salt, alice.address));

    await ethers.provider.send("evm_increaseTime", [COMMIT + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(voting.connect(alice).reveal(1, wrongSalt)).to.be.revertedWith(
      "bad reveal"
    );
  });

  it("Rejects commits after the commit deadline", async () => {
    await ethers.provider.send("evm_increaseTime", [COMMIT + 1]);
    await ethers.provider.send("evm_mine", []);
    const salt = ethers.utils.formatBytes32String("late");
    await expect(
      voting.connect(alice).commit(commitHash(1, salt, alice.address))
    ).to.be.revertedWith("commit phase ended");
  });
});

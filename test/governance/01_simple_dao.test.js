const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Governance / SimpleDAO", function () {
  let deployer;
  let alice;
  let bob;
  let carol;
  let token;
  let dao;
  let treasury;

  const TOTAL_SUPPLY = ethers.utils.parseEther("1000");

  beforeEach(async function () {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    const Token = await ethers.getContractFactory(
      "contracts/governance/01_simple_dao/SimpleDAO.sol:GovToken"
    );
    token = await Token.deploy(TOTAL_SUPPLY);
    await token.deployed();

    const DAO = await ethers.getContractFactory(
      "contracts/governance/01_simple_dao/SimpleDAO.sol:SimpleDAO"
    );
    dao = await DAO.deploy(token.address);
    await dao.deployed();

    const Treasury = await ethers.getContractFactory(
      "contracts/governance/01_simple_dao/SimpleDAO.sol:Treasury"
    );
    treasury = await Treasury.deploy(dao.address);
    await treasury.deployed();

    // Distribute voting power.
    await token.transfer(alice.address, ethers.utils.parseEther("400"));
    await token.transfer(bob.address, ethers.utils.parseEther("300"));
    await token.transfer(carol.address, ethers.utils.parseEther("100"));
    // deployer keeps 200.
  });

  async function advancePast(seconds) {
    await network.provider.send("evm_increaseTime", [seconds + 1]);
    await network.provider.send("evm_mine");
  }

  it("creates, votes for, and executes a proposal that updates the Treasury", async function () {
    const newMessage = "DAO was here";
    const calldata = treasury.interface.encodeFunctionData("setMessage", [
      newMessage,
    ]);

    const tx = await dao
      .connect(alice)
      .propose("Set treasury message", treasury.address, calldata);
    const receipt = await tx.wait();
    const evt = receipt.events.find((e) => e.event === "ProposalCreated");
    const id = evt.args.id;

    await dao.connect(alice).vote(id, true); // 400 for
    await dao.connect(bob).vote(id, true); // 300 for
    await dao.connect(carol).vote(id, false); // 100 against

    // Voting still open: cannot execute yet.
    await expect(dao.execute(id)).to.be.revertedWith("SimpleDAO: voting open");

    const VOTING_PERIOD = 3 * 24 * 60 * 60;
    await advancePast(VOTING_PERIOD);

    await dao.execute(id);

    expect(await treasury.message()).to.eq(newMessage);

    // Cannot execute twice.
    await expect(dao.execute(id)).to.be.revertedWith(
      "SimpleDAO: already executed"
    );
  });

  it("rejects execution when against >= for", async function () {
    const calldata = treasury.interface.encodeFunctionData("setMessage", [
      "should not apply",
    ]);
    const tx = await dao.connect(alice).propose("nope", treasury.address, calldata);
    const receipt = await tx.wait();
    const id = receipt.events.find((e) => e.event === "ProposalCreated").args.id;

    await dao.connect(alice).vote(id, false); // 400 against
    await dao.connect(bob).vote(id, true); // 300 for

    await advancePast(3 * 24 * 60 * 60);

    await expect(dao.execute(id)).to.be.revertedWith("SimpleDAO: not passed");
    expect(await treasury.message()).to.eq("");
  });

  it("blocks double votes and votes from zero-balance accounts", async function () {
    const calldata = treasury.interface.encodeFunctionData("setMessage", ["x"]);
    const tx = await dao.connect(alice).propose("p", treasury.address, calldata);
    const receipt = await tx.wait();
    const id = receipt.events.find((e) => e.event === "ProposalCreated").args.id;

    await dao.connect(alice).vote(id, true);
    await expect(dao.connect(alice).vote(id, true)).to.be.revertedWith(
      "SimpleDAO: already voted"
    );

    const [, , , , , noBalance] = await ethers.getSigners();
    await expect(dao.connect(noBalance).vote(id, true)).to.be.revertedWith(
      "SimpleDAO: no voting power"
    );
  });
});

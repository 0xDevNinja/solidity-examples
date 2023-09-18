const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, network } = hre;

// MyGovernor (OZ Governor + 5 extensions) exceeds the EIP-170 24576-byte limit
// without optimizer. Enable hardhat's unlimited contract size before the network
// provider is constructed, so we don't need to touch hardhat.config.js.
hre.network.config.allowUnlimitedContractSize = true;

describe("Governance / Governor + Timelock", function () {
  let deployer;
  let voter;
  let token;
  let timelock;
  let governor;
  let box;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const MIN_DELAY = 60; // seconds
  const VOTING_DELAY = 1; // blocks
  const VOTING_PERIOD = 50; // blocks

  // OZ TimelockController role hashes.
  const PROPOSER_ROLE = ethers.utils.id("PROPOSER_ROLE");
  const EXECUTOR_ROLE = ethers.utils.id("EXECUTOR_ROLE");
  const TIMELOCK_ADMIN_ROLE = ethers.utils.id("TIMELOCK_ADMIN_ROLE");

  beforeEach(async function () {
    [deployer, voter] = await ethers.getSigners();

    const Token = await ethers.getContractFactory(
      "contracts/governance/02_governor_timelock/MyToken.sol:MyToken"
    );
    token = await Token.deploy(INITIAL_SUPPLY);
    await token.deployed();

    // Distribute most supply to voter for self-delegation.
    await token.transfer(voter.address, ethers.utils.parseEther("500000"));

    const Timelock = await ethers.getContractFactory(
      "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController"
    );
    // OZ 4.7.3 TimelockController: (minDelay, proposers, executors).
    // Deployer is auto-granted TIMELOCK_ADMIN_ROLE so we can wire roles.
    timelock = await Timelock.deploy(MIN_DELAY, [], []);
    await timelock.deployed();

    const Governor = await ethers.getContractFactory(
      "contracts/governance/02_governor_timelock/MyGovernor.sol:MyGovernor"
    );
    governor = await Governor.deploy(token.address, timelock.address);
    await governor.deployed();

    // Wire roles: governor proposes/executes; revoke admin from deployer.
    await timelock.grantRole(PROPOSER_ROLE, governor.address);
    // Open executor (anyone may execute once timelock delay elapses).
    await timelock.grantRole(EXECUTOR_ROLE, ethers.constants.AddressZero);
    await timelock.revokeRole(TIMELOCK_ADMIN_ROLE, deployer.address);

    const Box = await ethers.getContractFactory(
      "contracts/governance/02_governor_timelock/GovernedBox.sol:GovernedBox"
    );
    box = await Box.deploy(timelock.address);
    await box.deployed();

    // Self-delegate so checkpointed votes are recorded.
    await token.connect(voter).delegate(voter.address);
    await token.connect(deployer).delegate(deployer.address);
  });

  async function mineBlocks(n) {
    await network.provider.send("hardhat_mine", ["0x" + n.toString(16)]);
  }

  it("runs the full proposal lifecycle: propose -> vote -> queue -> execute", async function () {
    const newValue = 777;
    const calldata = box.interface.encodeFunctionData("setValue", [newValue]);
    const description = "Set GovernedBox.value to 777";
    const descHash = ethers.utils.id(description);

    const targets = [box.address];
    const values = [0];
    const calldatas = [calldata];

    // Propose.
    const proposeTx = await governor
      .connect(voter)
      .propose(targets, values, calldatas, description);
    const receipt = await proposeTx.wait();
    const proposalId = receipt.events.find(
      (e) => e.event === "ProposalCreated"
    ).args.proposalId;

    // Advance past voting delay.
    await mineBlocks(VOTING_DELAY + 1);

    // Vote: 1 = For.
    await governor.connect(voter).castVote(proposalId, 1);

    // Advance past voting period.
    await mineBlocks(VOTING_PERIOD + 1);

    // Queue.
    await governor.queue(targets, values, calldatas, descHash);

    // Advance past timelock min delay.
    await network.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
    await network.provider.send("evm_mine");

    // Execute.
    await governor.execute(targets, values, calldatas, descHash);

    expect(await box.value()).to.eq(newValue);
  });

  it("blocks direct calls to the governed target outside governance", async function () {
    await expect(box.connect(deployer).setValue(1)).to.be.revertedWith(
      "GovernedBox: only governor"
    );
  });
});

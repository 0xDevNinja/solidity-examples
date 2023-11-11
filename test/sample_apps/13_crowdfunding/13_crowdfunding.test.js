const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Sample Apps / Crowdfunding", function () {
  let crowd;
  let creator;
  let alice;
  let bob;
  let outsider;

  beforeEach(async function () {
    [creator, alice, bob, outsider] = await ethers.getSigners();

    const F = await ethers.getContractFactory(
      "contracts/sample_apps/13_crowdfunding/Crowdfunding.sol:Crowdfunding"
    );
    crowd = await F.deploy();
    await crowd.deployed();
  });

  async function now() {
    const blk = await ethers.provider.getBlock("latest");
    return blk.timestamp;
  }

  async function advanceTo(ts) {
    await network.provider.send("evm_setNextBlockTimestamp", [ts]);
    await network.provider.send("evm_mine");
  }

  it("creates a campaign and accepts pledges from multiple users", async function () {
    const goal = ethers.utils.parseEther("5");
    const deadline = (await now()) + 7 * 24 * 60 * 60;

    const tx = await crowd.connect(creator).createCampaign(goal, deadline);
    const r = await tx.wait();
    const id = r.events.find((e) => e.event === "CampaignCreated").args.id;

    await crowd.connect(alice).pledge(id, { value: ethers.utils.parseEther("2") });
    await crowd.connect(bob).pledge(id, { value: ethers.utils.parseEther("1") });

    const c = await crowd.getCampaign(id);
    expect(c.creator).to.eq(creator.address);
    expect(c.goal).to.eq(goal);
    expect(c.pledged).to.eq(ethers.utils.parseEther("3"));
    expect(await crowd.pledgedAmount(id, alice.address)).to.eq(
      ethers.utils.parseEther("2")
    );
    expect(await crowd.pledgedAmount(id, bob.address)).to.eq(
      ethers.utils.parseEther("1")
    );
  });

  it("creator can claim funds when goal is met after deadline (success path)", async function () {
    const goal = ethers.utils.parseEther("3");
    const deadline = (await now()) + 1000;

    const tx = await crowd.connect(creator).createCampaign(goal, deadline);
    const id = (await tx.wait()).events.find(
      (e) => e.event === "CampaignCreated"
    ).args.id;

    await crowd.connect(alice).pledge(id, { value: ethers.utils.parseEther("2") });
    await crowd.connect(bob).pledge(id, { value: ethers.utils.parseEther("2") });

    // Cannot claim before deadline.
    await expect(crowd.connect(creator).claim(id)).to.be.revertedWith(
      "Crowdfunding: not ended"
    );

    await advanceTo(deadline + 1);

    // Non-creator cannot claim.
    await expect(crowd.connect(alice).claim(id)).to.be.revertedWith(
      "Crowdfunding: only creator"
    );

    const before = await ethers.provider.getBalance(creator.address);
    const claimTx = await crowd.connect(creator).claim(id);
    const claimReceipt = await claimTx.wait();
    const gas = claimReceipt.gasUsed.mul(claimReceipt.effectiveGasPrice);
    const after = await ethers.provider.getBalance(creator.address);

    expect(after.add(gas).sub(before)).to.eq(ethers.utils.parseEther("4"));

    // Cannot double claim.
    await expect(crowd.connect(creator).claim(id)).to.be.revertedWith(
      "Crowdfunding: already claimed"
    );
  });

  it("pledgers get refunded when the goal is not met (failure path)", async function () {
    const goal = ethers.utils.parseEther("10");
    const deadline = (await now()) + 1000;

    const tx = await crowd.connect(creator).createCampaign(goal, deadline);
    const id = (await tx.wait()).events.find(
      (e) => e.event === "CampaignCreated"
    ).args.id;

    await crowd.connect(alice).pledge(id, { value: ethers.utils.parseEther("1") });
    await crowd.connect(bob).pledge(id, { value: ethers.utils.parseEther("2") });

    // Cannot refund before deadline.
    await expect(crowd.connect(alice).refund(id)).to.be.revertedWith(
      "Crowdfunding: not ended"
    );

    await advanceTo(deadline + 1);

    // Creator cannot claim a failed campaign.
    await expect(crowd.connect(creator).claim(id)).to.be.revertedWith(
      "Crowdfunding: goal not met"
    );

    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const aliceTx = await crowd.connect(alice).refund(id);
    const aliceR = await aliceTx.wait();
    const aliceGas = aliceR.gasUsed.mul(aliceR.effectiveGasPrice);
    const aliceAfter = await ethers.provider.getBalance(alice.address);
    expect(aliceAfter.add(aliceGas).sub(aliceBefore)).to.eq(
      ethers.utils.parseEther("1")
    );
    expect(await crowd.pledgedAmount(id, alice.address)).to.eq(0);

    // Cannot refund twice.
    await expect(crowd.connect(alice).refund(id)).to.be.revertedWith(
      "Crowdfunding: nothing to refund"
    );

    // Outsider with no pledge cannot drain.
    await expect(crowd.connect(outsider).refund(id)).to.be.revertedWith(
      "Crowdfunding: nothing to refund"
    );
  });

  it("rejects bad inputs", async function () {
    await expect(
      crowd.createCampaign(0, (await now()) + 1000)
    ).to.be.revertedWith("Crowdfunding: goal=0");

    await expect(
      crowd.createCampaign(ethers.utils.parseEther("1"), 1)
    ).to.be.revertedWith("Crowdfunding: deadline in past");

    const tx = await crowd.createCampaign(
      ethers.utils.parseEther("1"),
      (await now()) + 1000
    );
    const id = (await tx.wait()).events.find(
      (e) => e.event === "CampaignCreated"
    ).args.id;

    await expect(crowd.pledge(id, { value: 0 })).to.be.revertedWith(
      "Crowdfunding: zero pledge"
    );
  });
});

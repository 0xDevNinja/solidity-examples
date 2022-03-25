const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security Patterns / Pull Payment", function () {
  let auction, alice, bob, carol;

  beforeEach(async () => {
    [alice, bob, carol] = await ethers.getSigners();
    const Auction = await ethers.getContractFactory(
      "contracts/security_patterns/02_pull_payment/Auction.sol:Auction"
    );
    auction = await Auction.deploy();
    await auction.deployed();
  });

  it("Tracks highest bidder", async () => {
    await auction.connect(alice).bid({ value: ethers.utils.parseEther("1") });
    expect(await auction.highestBidder()).to.equal(alice.address);
    expect(await auction.highestBid()).to.equal(ethers.utils.parseEther("1"));
  });

  it("Outbid bidder can pull their refund", async () => {
    await auction.connect(alice).bid({ value: ethers.utils.parseEther("1") });
    await auction.connect(bob).bid({ value: ethers.utils.parseEther("2") });

    expect(await auction.pendingReturns(alice.address)).to.equal(
      ethers.utils.parseEther("1")
    );

    await expect(() => auction.connect(alice).withdraw()).to.changeEtherBalance(
      alice,
      ethers.utils.parseEther("1")
    );
    expect(await auction.pendingReturns(alice.address)).to.equal(0);
  });

  it("Reverts when nothing to withdraw", async () => {
    await expect(auction.connect(carol).withdraw()).to.be.revertedWith(
      "Nothing to withdraw"
    );
  });
});

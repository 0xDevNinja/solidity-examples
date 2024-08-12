const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeFi Primitives / Bonding Curve", function () {
  let curve, alice, bob;
  const SLOPE = ethers.BigNumber.from("1000000000000000"); // 1e15

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/defi_primitives/05_bonding_curve/BondingCurveToken.sol:BondingCurveToken"
    );
    curve = await F.deploy(SLOPE);
    await curve.deployed();
  });

  it("buy mints tokens, increases reserve, refunds dust on sell", async () => {
    const ethIn = ethers.utils.parseEther("1");

    await curve.connect(alice).buy({ value: ethIn });

    const supply = await curve.totalSupply();
    const reserve = await curve.reserve();
    const balance = await curve.balanceOf(alice.address);

    expect(supply).to.be.gt(0);
    expect(reserve).to.be.gt(0);
    expect(balance).to.equal(supply);

    // Now sell back the same tokens.
    const reserveBefore = await curve.reserve();
    const ethBalanceBefore = await ethers.provider.getBalance(alice.address);

    const tx = await curve.connect(alice).sell(balance);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    const ethBalanceAfter = await ethers.provider.getBalance(alice.address);
    const ethReceived = ethBalanceAfter.sub(ethBalanceBefore).add(gasUsed);

    // Refund should approximately match what was paid into the reserve (within 1 wei).
    const diff = ethReceived.sub(reserveBefore).abs();
    expect(diff).to.be.lte(1);

    expect(await curve.reserve()).to.equal(0);
    expect(await curve.totalSupply()).to.equal(0);
    expect(await curve.balanceOf(alice.address)).to.equal(0);
  });

  it("price increases as more tokens are minted (alice then bob)", async () => {
    const ethIn = ethers.utils.parseEther("1");

    const spotInitial = await curve.spotPrice();
    expect(spotInitial).to.equal(0);

    await curve.connect(alice).buy({ value: ethIn });
    const spotAfterAlice = await curve.spotPrice();

    await curve.connect(bob).buy({ value: ethIn });
    const spotAfterBob = await curve.spotPrice();

    expect(spotAfterAlice).to.be.gt(spotInitial);
    expect(spotAfterBob).to.be.gt(spotAfterAlice);

    // Both buyers received tokens.
    expect(await curve.balanceOf(alice.address)).to.be.gt(0);
    expect(await curve.balanceOf(bob.address)).to.be.gt(0);
    // Bob, buying second at a higher price, should get fewer tokens for the same ETH.
    expect(await curve.balanceOf(bob.address)).to.be.lt(
      await curve.balanceOf(alice.address)
    );
  });

  it("quoteBuy matches actual minted amount", async () => {
    const ethIn = ethers.utils.parseEther("0.5");
    const quoted = await curve.quoteBuy(ethIn);
    await curve.connect(alice).buy({ value: ethIn });
    expect(await curve.balanceOf(alice.address)).to.equal(quoted);
  });

  it("reverts buy with zero value", async () => {
    await expect(curve.connect(alice).buy({ value: 0 })).to.be.revertedWith(
      "zero value"
    );
  });
});

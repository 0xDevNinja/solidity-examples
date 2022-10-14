const { expect } = require("chai");
const { ethers, network } = require("hardhat");

async function latest() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

async function increaseTo(ts) {
  await network.provider.send("evm_setNextBlockTimestamp", [ts]);
  await network.provider.send("evm_mine");
}

describe("DeFi Primitives / Linear Vesting", function () {
  let token, vesting, alice, beneficiary;
  const TOTAL = ethers.utils.parseEther("1000");
  const DURATION = 1000; // seconds
  let start;

  beforeEach(async () => {
    [alice, beneficiary] = await ethers.getSigners();

    const ERC = await ethers.getContractFactory(
      "contracts/defi_primitives/_helpers/TestERC20.sol:TestERC20"
    );
    token = await ERC.deploy("Vest", "VST");
    await token.deployed();

    start = (await latest()) + 100;

    const Vest = await ethers.getContractFactory(
      "contracts/defi_primitives/02_linear_vesting/LinearVesting.sol:LinearVesting"
    );
    vesting = await Vest.deploy(
      token.address,
      beneficiary.address,
      start,
      DURATION
    );
    await vesting.deployed();

    // Fund the vesting wallet.
    await token.mint(vesting.address, TOTAL);
  });

  it("Vests nothing before start", async () => {
    expect(await vesting.vestedAmount(start - 1)).to.equal(0);
    await expect(vesting.release()).to.be.revertedWith("Nothing to release");
  });

  it("Releases ~half at the midpoint", async () => {
    await increaseTo(start + DURATION / 2);
    await vesting.release();

    const balance = await token.balanceOf(beneficiary.address);
    // Allow a small drift (a couple seconds) from extra mined blocks.
    const half = TOTAL.div(2);
    const drift = TOTAL.mul(5).div(DURATION); // 5s tolerance
    expect(balance).to.be.gte(half.sub(drift));
    expect(balance).to.be.lte(half.add(drift));
  });

  it("Releases full allocation at end", async () => {
    await increaseTo(start + DURATION + 1);
    await vesting.release();

    expect(await token.balanceOf(beneficiary.address)).to.equal(TOTAL);
    expect(await token.balanceOf(vesting.address)).to.equal(0);
  });

  it("Cannot release twice without time passing meaningfully", async () => {
    await increaseTo(start + DURATION + 1);
    await vesting.release();
    await expect(vesting.release()).to.be.revertedWith("Nothing to release");
  });
});

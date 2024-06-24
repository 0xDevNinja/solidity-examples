const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeFi Primitives / Constant Product AMM", function () {
  let amm, t0, t1, alice, bob;

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();

    const ERC = await ethers.getContractFactory(
      "contracts/defi_primitives/_helpers/TestERC20.sol:TestERC20"
    );
    t0 = await ERC.deploy("Token0", "T0");
    await t0.deployed();
    t1 = await ERC.deploy("Token1", "T1");
    await t1.deployed();

    // Sort addresses to match constructor expectation (any order is fine, we just pick).
    const AMM = await ethers.getContractFactory(
      "contracts/defi_primitives/04_constant_product_amm/ConstantProductAMM.sol:ConstantProductAMM"
    );
    amm = await AMM.deploy(t0.address, t1.address);
    await amm.deployed();

    // Mint and approve.
    const big = ethers.utils.parseEther("1000000");
    await t0.mint(alice.address, big);
    await t1.mint(alice.address, big);
    await t0.mint(bob.address, big);
    await t1.mint(bob.address, big);
    await t0.connect(alice).approve(amm.address, ethers.constants.MaxUint256);
    await t1.connect(alice).approve(amm.address, ethers.constants.MaxUint256);
    await t0.connect(bob).approve(amm.address, ethers.constants.MaxUint256);
    await t1.connect(bob).approve(amm.address, ethers.constants.MaxUint256);
  });

  it("Adds liquidity, swaps, and roughly preserves x*y=k modulo fee", async () => {
    const a0 = ethers.utils.parseEther("100");
    const a1 = ethers.utils.parseEther("400");
    await amm.connect(alice).addLiquidity(a0, a1);

    expect(await amm.reserve0()).to.equal(a0);
    expect(await amm.reserve1()).to.equal(a1);
    const shares = await amm.sharesOf(alice.address);
    expect(shares).to.be.gt(0);

    const kBefore = a0.mul(a1);

    const swapIn = ethers.utils.parseEther("10");
    await amm.connect(bob).swap(t0.address, swapIn);

    const r0 = await amm.reserve0();
    const r1 = await amm.reserve1();
    expect(r0).to.equal(a0.add(swapIn));
    expect(r1).to.be.lt(a1);

    // With a 0.3% fee k should grow slightly, never shrink.
    const kAfter = r0.mul(r1);
    expect(kAfter).to.be.gte(kBefore);
  });

  it("Removes liquidity proportionally", async () => {
    const a0 = ethers.utils.parseEther("100");
    const a1 = ethers.utils.parseEther("100");
    await amm.connect(alice).addLiquidity(a0, a1);

    const shares = await amm.sharesOf(alice.address);
    const t0Before = await t0.balanceOf(alice.address);
    const t1Before = await t1.balanceOf(alice.address);

    await amm.connect(alice).removeLiquidity(shares);

    expect(await amm.sharesOf(alice.address)).to.equal(0);
    expect(await amm.totalShares()).to.equal(0);
    expect(await t0.balanceOf(alice.address)).to.equal(t0Before.add(a0));
    expect(await t1.balanceOf(alice.address)).to.equal(t1Before.add(a1));
  });

  it("Reverts swap with zero amount", async () => {
    const a0 = ethers.utils.parseEther("100");
    const a1 = ethers.utils.parseEther("100");
    await amm.connect(alice).addLiquidity(a0, a1);
    await expect(amm.connect(bob).swap(t0.address, 0)).to.be.revertedWith(
      "zero in"
    );
  });
});

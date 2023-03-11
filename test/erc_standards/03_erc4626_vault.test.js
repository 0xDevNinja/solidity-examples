const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC Standards / ERC-4626 Vault", function () {
  let asset;
  let vault;
  let alice;
  let bob;

  beforeEach(async function () {
    [, alice, bob] = await ethers.getSigners();

    const Asset = await ethers.getContractFactory(
      "contracts/erc_standards/_helpers/TestERC20.sol:TestERC20"
    );
    asset = await Asset.deploy("Underlying", "UND");
    await asset.deployed();

    const Vault = await ethers.getContractFactory(
      "contracts/erc_standards/03_erc4626_vault/MyVault.sol:MyVault"
    );
    vault = await Vault.deploy(asset.address, "Vault Share", "vUND");
    await vault.deployed();

    await asset.mint(alice.address, ethers.utils.parseEther("1000"));
    await asset.mint(bob.address, ethers.utils.parseEther("1000"));
  });

  it("reports the underlying asset", async function () {
    expect(await vault.asset()).to.eq(asset.address);
  });

  it("first deposit mints shares 1:1", async function () {
    const amount = ethers.utils.parseEther("100");
    await asset.connect(alice).approve(vault.address, amount);

    await vault.connect(alice).deposit(amount, alice.address);

    expect(await vault.balanceOf(alice.address)).to.eq(amount);
    expect(await vault.totalAssets()).to.eq(amount);
    expect(await vault.totalSupply()).to.eq(amount);
    expect(await asset.balanceOf(vault.address)).to.eq(amount);
  });

  it("redeem returns the deposited assets", async function () {
    const amount = ethers.utils.parseEther("50");
    await asset.connect(alice).approve(vault.address, amount);
    await vault.connect(alice).deposit(amount, alice.address);

    const shares = await vault.balanceOf(alice.address);
    const before = await asset.balanceOf(alice.address);

    await vault.connect(alice).redeem(shares, alice.address, alice.address);

    expect(await vault.balanceOf(alice.address)).to.eq(0);
    expect(await asset.balanceOf(alice.address)).to.eq(before.add(amount));
    expect(await vault.totalAssets()).to.eq(0);
  });

  it("multiple depositors share the vault proportionally", async function () {
    const a = ethers.utils.parseEther("100");
    const b = ethers.utils.parseEther("300");

    await asset.connect(alice).approve(vault.address, a);
    await asset.connect(bob).approve(vault.address, b);

    await vault.connect(alice).deposit(a, alice.address);
    await vault.connect(bob).deposit(b, bob.address);

    expect(await vault.balanceOf(alice.address)).to.eq(a);
    expect(await vault.balanceOf(bob.address)).to.eq(b);
    expect(await vault.totalAssets()).to.eq(a.add(b));
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC Standards / ERC1155 GameItems", function () {
  let game, alice, bob;
  const GOLD = 0;
  const SILVER = 1;
  const SWORD = 2;

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/erc_standards/01_erc1155/GameItems.sol:GameItems"
    );
    game = await F.deploy();
    await game.deployed();
  });

  it("Mints initial supply to deployer", async () => {
    expect(await game.balanceOf(alice.address, GOLD)).to.equal(
      ethers.utils.parseEther("10000")
    );
    expect(await game.balanceOf(alice.address, SILVER)).to.equal(
      ethers.utils.parseEther("100000")
    );
    expect(await game.balanceOf(alice.address, SWORD)).to.equal(1000);
    expect(await game.balanceOf(bob.address, GOLD)).to.equal(0);
  });

  it("Sets the URI in the constructor", async () => {
    expect(await game.uri(GOLD)).to.equal(
      "https://game.example/api/item/{id}.json"
    );
  });

  it("Transfers a single id", async () => {
    await game
      .connect(alice)
      .safeTransferFrom(alice.address, bob.address, SWORD, 5, "0x");
    expect(await game.balanceOf(bob.address, SWORD)).to.equal(5);
    expect(await game.balanceOf(alice.address, SWORD)).to.equal(995);
  });

  it("Batch transfers multiple ids", async () => {
    await game
      .connect(alice)
      .safeBatchTransferFrom(
        alice.address,
        bob.address,
        [GOLD, SILVER, SWORD],
        [
          ethers.utils.parseEther("100"),
          ethers.utils.parseEther("250"),
          7,
        ],
        "0x"
      );

    expect(await game.balanceOf(bob.address, GOLD)).to.equal(
      ethers.utils.parseEther("100")
    );
    expect(await game.balanceOf(bob.address, SILVER)).to.equal(
      ethers.utils.parseEther("250")
    );
    expect(await game.balanceOf(bob.address, SWORD)).to.equal(7);
  });
});

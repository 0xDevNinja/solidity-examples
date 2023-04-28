const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Upgradeability / UUPS Counter", function () {
  let owner;
  let other;
  let V1;
  let V2;
  let v1Impl;
  let v2Impl;
  let proxy;
  let proxied;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    V1 = await ethers.getContractFactory(
      "contracts/upgradeability/01_uups/CounterV1.sol:CounterV1"
    );
    V2 = await ethers.getContractFactory(
      "contracts/upgradeability/01_uups/CounterV2.sol:CounterV2"
    );
    const Proxy = await ethers.getContractFactory(
      "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"
    );

    v1Impl = await V1.deploy();
    await v1Impl.deployed();

    const initData = V1.interface.encodeFunctionData("initialize", []);
    proxy = await Proxy.deploy(v1Impl.address, initData);
    await proxy.deployed();

    proxied = V1.attach(proxy.address);
  });

  it("initializes owner and starts count at 0", async function () {
    expect(await proxied.owner()).to.eq(owner.address);
    expect(await proxied.count()).to.eq(0);
  });

  it("increments through the proxy", async function () {
    await proxied.increment();
    await proxied.increment();
    expect(await proxied.count()).to.eq(2);
  });

  it("only owner can authorize upgrade", async function () {
    v2Impl = await V2.deploy();
    await v2Impl.deployed();

    await expect(
      proxied.connect(other).upgradeTo(v2Impl.address)
    ).to.be.revertedWith("CounterV1: only owner");
  });

  it("upgrades to V2 and preserves state, exposes decrement()", async function () {
    await proxied.increment();
    await proxied.increment();
    await proxied.increment();
    expect(await proxied.count()).to.eq(3);

    v2Impl = await V2.deploy();
    await v2Impl.deployed();

    await proxied.upgradeTo(v2Impl.address);

    const proxiedV2 = V2.attach(proxy.address);

    // State preserved across upgrade.
    expect(await proxiedV2.owner()).to.eq(owner.address);
    expect(await proxiedV2.count()).to.eq(3);

    // New behavior available.
    await proxiedV2.decrement();
    expect(await proxiedV2.count()).to.eq(2);

    // Existing behavior still works.
    await proxiedV2.increment();
    expect(await proxiedV2.count()).to.eq(3);
  });
});

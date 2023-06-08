const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Upgradeability / Transparent Proxy Box", function () {
  let admin;
  let user;
  let proxyAdmin;
  let boxImpl;
  let boxV2Impl;
  let proxy;
  let Box;
  let BoxV2;

  beforeEach(async function () {
    [admin, user] = await ethers.getSigners();

    Box = await ethers.getContractFactory(
      "contracts/upgradeability/02_transparent/Box.sol:Box"
    );
    BoxV2 = await ethers.getContractFactory(
      "contracts/upgradeability/02_transparent/BoxV2.sol:BoxV2"
    );
    const ProxyAdmin = await ethers.getContractFactory(
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol:ProxyAdmin"
    );
    const TransparentProxy = await ethers.getContractFactory(
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
    );

    proxyAdmin = await ProxyAdmin.deploy();
    await proxyAdmin.deployed();

    boxImpl = await Box.deploy();
    await boxImpl.deployed();

    const initData = Box.interface.encodeFunctionData("store", [42]);
    proxy = await TransparentProxy.deploy(
      boxImpl.address,
      proxyAdmin.address,
      initData
    );
    await proxy.deployed();
  });

  it("initial call data is applied through the proxy", async function () {
    const proxied = Box.attach(proxy.address);
    expect(await proxied.connect(user).retrieve()).to.eq(42);
  });

  it("non-admin can call implementation methods through the proxy", async function () {
    const proxied = Box.attach(proxy.address);
    await proxied.connect(user).store(100);
    expect(await proxied.connect(user).retrieve()).to.eq(100);
  });

  it("upgrades to V2 via ProxyAdmin and exposes increment()", async function () {
    const proxied = Box.attach(proxy.address);
    await proxied.connect(user).store(42);
    expect(await proxied.connect(user).retrieve()).to.eq(42);

    boxV2Impl = await BoxV2.deploy();
    await boxV2Impl.deployed();

    await proxyAdmin.connect(admin).upgrade(proxy.address, boxV2Impl.address);

    const proxiedV2 = BoxV2.attach(proxy.address);

    // State preserved.
    expect(await proxiedV2.connect(user).retrieve()).to.eq(42);

    // New behavior.
    await proxiedV2.connect(user).increment();
    expect(await proxiedV2.connect(user).retrieve()).to.eq(43);
  });

  it("only ProxyAdmin owner can upgrade", async function () {
    boxV2Impl = await BoxV2.deploy();
    await boxV2Impl.deployed();

    await expect(
      proxyAdmin
        .connect(user)
        .upgrade(proxy.address, boxV2Impl.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});

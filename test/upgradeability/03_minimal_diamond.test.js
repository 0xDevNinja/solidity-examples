const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Upgradeability / Minimal Diamond", function () {
  let owner, other;
  let Diamond, ExampleFacet;
  let diamond, facet;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();

    Diamond = await ethers.getContractFactory(
      "contracts/upgradeability/03_minimal_diamond/Diamond.sol:Diamond"
    );
    ExampleFacet = await ethers.getContractFactory(
      "contracts/upgradeability/03_minimal_diamond/ExampleFacet.sol:ExampleFacet"
    );

    diamond = await Diamond.deploy();
    await diamond.deployed();

    facet = await ExampleFacet.deploy();
    await facet.deployed();
  });

  it("routes setX/getX calls to the facet via delegatecall", async () => {
    const setXSel = ExampleFacet.interface.getSighash("setX(uint256)");
    const getXSel = ExampleFacet.interface.getSighash("getX()");

    await diamond.addFacet(facet.address, [setXSel, getXSel]);

    expect(await diamond.facets(setXSel)).to.equal(facet.address);
    expect(await diamond.facets(getXSel)).to.equal(facet.address);

    // Treat the diamond as the facet via the ABI.
    const proxy = ExampleFacet.attach(diamond.address);
    await proxy.setX(42);
    expect(await proxy.getX()).to.equal(42);

    // Sanity check: the facet's own storage at the same slot is untouched —
    // delegatecall wrote into the diamond.
    expect(await facet.getX()).to.equal(0);
  });

  it("reverts with 'function does not exist' for unknown selectors", async () => {
    // Random 4-byte selector that has not been registered. Send as a
    // transaction so the EVM revert surfaces as a thrown error.
    await expect(
      owner.sendTransaction({ to: diamond.address, data: "0xdeadbeef" })
    ).to.be.revertedWith("Diamond: function does not exist");
  });

  it("only owner can addFacet", async () => {
    const setXSel = ExampleFacet.interface.getSighash("setX(uint256)");
    await expect(
      diamond.connect(other).addFacet(facet.address, [setXSel])
    ).to.be.revertedWith("Diamond: only owner");
  });

  it("rejects zero-address facet", async () => {
    const setXSel = ExampleFacet.interface.getSighash("setX(uint256)");
    await expect(
      diamond.addFacet(ethers.constants.AddressZero, [setXSel])
    ).to.be.revertedWith("Diamond: zero facet");
  });

  it("emits FacetAdded with selectors", async () => {
    const setXSel = ExampleFacet.interface.getSighash("setX(uint256)");
    const getXSel = ExampleFacet.interface.getSighash("getX()");
    await expect(diamond.addFacet(facet.address, [setXSel, getXSel]))
      .to.emit(diamond, "FacetAdded")
      .withArgs(facet.address, [setXSel, getXSel]);
  });
});

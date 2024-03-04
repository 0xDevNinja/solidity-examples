const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security Patterns / EIP-712 Typed Signer", function () {
  let signer, alice, bob, eve;
  let domain, types;

  beforeEach(async () => {
    [alice, bob, eve] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/security_patterns/05_eip712_typed_data/TypedSigner.sol:TypedSigner"
    );
    signer = await F.deploy();
    await signer.deployed();

    const network = await ethers.provider.getNetwork();
    domain = {
      name: "TypedSigner",
      version: "1",
      chainId: network.chainId,
      verifyingContract: signer.address,
    };
    types = {
      Order: [
        { name: "maker", type: "address" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
  });

  function makeOrder(overrides = {}) {
    return {
      maker: alice.address,
      token: ethers.constants.AddressZero,
      amount: ethers.utils.parseEther("1"),
      nonce: 1,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    };
  }

  it("Verifies a valid EIP-712 signature from the maker", async () => {
    const order = makeOrder();
    const sig = await alice._signTypedData(domain, types, order);
    expect(await signer.verify(order, sig)).to.equal(true);
  });

  it("Rejects a signature from a non-maker", async () => {
    const order = makeOrder();
    const sig = await eve._signTypedData(domain, types, order);
    expect(await signer.verify(order, sig)).to.equal(false);
  });

  it("Reverts replay after execute consumes the nonce", async () => {
    const order = makeOrder({ nonce: 42 });
    const sig = await alice._signTypedData(domain, types, order);
    await signer.execute(order, sig);
    await expect(signer.execute(order, sig)).to.be.revertedWith("nonce used");
    expect(await signer.verify(order, sig)).to.equal(false);
  });

  it("Rejects expired orders", async () => {
    const order = makeOrder({ nonce: 7, deadline: 1 });
    const sig = await alice._signTypedData(domain, types, order);
    expect(await signer.verify(order, sig)).to.equal(false);
    await expect(signer.execute(order, sig)).to.be.revertedWith("expired");
  });
});

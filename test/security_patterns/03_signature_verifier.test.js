const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security Patterns / Signature Verifier", function () {
  let verifier, alice, bob;

  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/security_patterns/03_signature_verifier/SignatureVerifier.sol:SignatureVerifier"
    );
    verifier = await F.deploy();
    await verifier.deployed();
  });

  it("Verifies a valid signature from the claimed signer", async () => {
    const to = bob.address;
    const amount = ethers.utils.parseEther("1");
    const nonce = "nonce-1";

    const messageHash = await verifier.getMessageHash(to, amount, nonce);
    const sig = await alice.signMessage(ethers.utils.arrayify(messageHash));

    expect(await verifier.verify(alice.address, to, amount, nonce, sig)).to
      .equal(true);
  });

  it("Rejects when the signer address does not match", async () => {
    const to = bob.address;
    const amount = ethers.utils.parseEther("1");
    const nonce = "nonce-2";

    const messageHash = await verifier.getMessageHash(to, amount, nonce);
    const sig = await alice.signMessage(ethers.utils.arrayify(messageHash));

    // Pretending bob signed should fail.
    expect(await verifier.verify(bob.address, to, amount, nonce, sig)).to.equal(
      false
    );
  });

  it("Rejects when message contents are tampered with", async () => {
    const to = bob.address;
    const amount = ethers.utils.parseEther("1");
    const nonce = "nonce-3";

    const messageHash = await verifier.getMessageHash(to, amount, nonce);
    const sig = await alice.signMessage(ethers.utils.arrayify(messageHash));

    // Tamper with amount.
    expect(
      await verifier.verify(
        alice.address,
        to,
        ethers.utils.parseEther("2"),
        nonce,
        sig
      )
    ).to.equal(false);
  });
});

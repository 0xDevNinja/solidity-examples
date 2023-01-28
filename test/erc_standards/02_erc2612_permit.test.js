const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC Standards / ERC-2612 Permit", function () {
  let token;
  let owner;
  let spender;
  let recipient;

  const NAME = "PermitToken";
  const SYMBOL = "PMT";

  beforeEach(async function () {
    [owner, spender, recipient] = await ethers.getSigners();

    const F = await ethers.getContractFactory(
      "contracts/erc_standards/02_erc2612_permit/PermitToken.sol:PermitToken"
    );
    token = await F.deploy(NAME, SYMBOL);
    await token.deployed();

    await token.mint(owner.address, ethers.utils.parseEther("1000"));
  });

  it("exposes DOMAIN_SEPARATOR and zero initial nonce", async function () {
    const ds = await token.DOMAIN_SEPARATOR();
    expect(ds).to.be.a("string");
    expect(ds.length).to.eq(66); // 0x + 64 hex chars
    expect(await token.nonces(owner.address)).to.eq(0);
  });

  it("permit() grants allowance via signed message and transferFrom works", async function () {
    const value = ethers.utils.parseEther("100");
    const deadline = ethers.constants.MaxUint256;
    const nonce = await token.nonces(owner.address);

    const { chainId } = await ethers.provider.getNetwork();

    const domain = {
      name: NAME,
      version: "1",
      chainId,
      verifyingContract: token.address,
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const message = {
      owner: owner.address,
      spender: spender.address,
      value,
      nonce,
      deadline,
    };

    const signature = await owner._signTypedData(domain, types, message);
    const { v, r, s } = ethers.utils.splitSignature(signature);

    // Anyone can submit the permit; submit it from the spender.
    await token
      .connect(spender)
      .permit(owner.address, spender.address, value, deadline, v, r, s);

    expect(await token.allowance(owner.address, spender.address)).to.eq(value);
    expect(await token.nonces(owner.address)).to.eq(nonce.add(1));

    // Use the granted allowance.
    await token
      .connect(spender)
      .transferFrom(owner.address, recipient.address, value);

    expect(await token.balanceOf(recipient.address)).to.eq(value);
    expect(await token.allowance(owner.address, spender.address)).to.eq(0);
  });

  it("rejects expired permit", async function () {
    const value = ethers.utils.parseEther("1");
    const deadline = 1; // Past
    const nonce = await token.nonces(owner.address);
    const { chainId } = await ethers.provider.getNetwork();

    const domain = {
      name: NAME,
      version: "1",
      chainId,
      verifyingContract: token.address,
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const message = {
      owner: owner.address,
      spender: spender.address,
      value,
      nonce,
      deadline,
    };

    const sig = await owner._signTypedData(domain, types, message);
    const { v, r, s } = ethers.utils.splitSignature(sig);

    await expect(
      token.permit(owner.address, spender.address, value, deadline, v, r, s)
    ).to.be.revertedWith("ERC20Permit: expired deadline");
  });
});

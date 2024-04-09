const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Account Abstraction / SimpleAccount", function () {
  let owner, other;
  let entryPoint, account, target;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();

    const EP = await ethers.getContractFactory(
      "contracts/account_abstraction/01_simple_account/EntryPointMock.sol:EntryPointMock"
    );
    entryPoint = await EP.deploy();
    await entryPoint.deployed();

    const SA = await ethers.getContractFactory(
      "contracts/account_abstraction/01_simple_account/SimpleAccount.sol:SimpleAccount"
    );
    account = await SA.deploy(owner.address, entryPoint.address);
    await account.deployed();

    const T = await ethers.getContractFactory(
      "contracts/account_abstraction/01_simple_account/Target.sol:Target"
    );
    target = await T.deploy();
    await target.deployed();

    // Fund the account so it can pay for the inner call value.
    await owner.sendTransaction({
      to: account.address,
      value: ethers.utils.parseEther("1"),
    });
  });

  function buildOp({ sender, nonce, to, value, data, callGasLimit = 200000 }) {
    const callData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "bytes"],
      [to, value, data]
    );
    return { sender, nonce, callData, callGasLimit };
  }

  it("Executes a UserOp signed by the owner", async () => {
    const data = target.interface.encodeFunctionData("setValue", [42]);
    const op = buildOp({
      sender: account.address,
      nonce: 0,
      to: target.address,
      value: ethers.utils.parseEther("0.1"),
      data,
    });

    const opHash = await entryPoint.getOpHash(op);
    const sig = await owner.signMessage(ethers.utils.arrayify(opHash));

    await entryPoint.handleOp(op, sig);

    expect(await target.value()).to.equal(42);
    expect(await target.lastCaller()).to.equal(account.address);
    expect(
      await ethers.provider.getBalance(target.address)
    ).to.equal(ethers.utils.parseEther("0.1"));
    expect(await account.nonce()).to.equal(1);
  });

  it("Reverts when the signature is from a non-owner", async () => {
    const data = target.interface.encodeFunctionData("setValue", [7]);
    const op = buildOp({
      sender: account.address,
      nonce: 0,
      to: target.address,
      value: 0,
      data,
    });

    const opHash = await entryPoint.getOpHash(op);
    const sig = await other.signMessage(ethers.utils.arrayify(opHash));

    await expect(entryPoint.handleOp(op, sig)).to.be.revertedWith(
      "invalid signature"
    );
  });

  it("Rejects direct execute calls from non-EntryPoint", async () => {
    await expect(
      account.connect(owner).execute(target.address, 0, "0x")
    ).to.be.revertedWith("only entry point");
  });
});

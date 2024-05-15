const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Account Abstraction / Paymaster", function () {
  let paymaster, owner, sponsor, account, attacker;

  beforeEach(async () => {
    [owner, sponsor, account, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/account_abstraction/02_paymaster/Paymaster.sol:Paymaster"
    );
    paymaster = await F.connect(owner).deploy();
    await paymaster.deployed();
  });

  it("Tracks deposits and validates payment", async () => {
    const amount = ethers.utils.parseEther("0.5");
    await paymaster
      .connect(sponsor)
      .sponsor(account.address, amount, { value: amount });

    expect(await paymaster.deposits(account.address)).to.equal(amount);
    expect(await paymaster.validatePayment(account.address)).to.equal(true);
    expect(await paymaster.validatePayment(attacker.address)).to.equal(false);
  });

  it("Allows the owner to withdraw", async () => {
    const amount = ethers.utils.parseEther("1");
    await paymaster
      .connect(sponsor)
      .sponsor(account.address, amount, { value: amount });

    const before = await ethers.provider.getBalance(owner.address);
    const tx = await paymaster.connect(owner).withdraw(amount);
    const rcpt = await tx.wait();
    const gasCost = rcpt.gasUsed.mul(rcpt.effectiveGasPrice);
    const after = await ethers.provider.getBalance(owner.address);
    expect(after.add(gasCost).sub(before)).to.equal(amount);
  });

  it("Reverts withdraw from non-owner", async () => {
    const amount = ethers.utils.parseEther("0.1");
    await paymaster
      .connect(sponsor)
      .sponsor(account.address, amount, { value: amount });

    await expect(
      paymaster.connect(attacker).withdraw(amount)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Reverts when value does not match amount", async () => {
    await expect(
      paymaster
        .connect(sponsor)
        .sponsor(account.address, ethers.utils.parseEther("1"), {
          value: ethers.utils.parseEther("0.5"),
        })
    ).to.be.revertedWith("amount mismatch");
  });
});

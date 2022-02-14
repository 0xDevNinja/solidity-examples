const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security Patterns / Reentrancy", function () {
  let attacker, victim, attackerEOA, depositor;

  async function deployVulnerable() {
    const Bank = await ethers.getContractFactory(
      "contracts/security_patterns/01_reentrancy_attack/VulnerableBank.sol:VulnerableBank"
    );
    const bank = await Bank.deploy();
    await bank.deployed();
    return bank;
  }

  async function deploySafe() {
    const Bank = await ethers.getContractFactory(
      "contracts/security_patterns/01_reentrancy_attack/SafeBank.sol:SafeBank"
    );
    const bank = await Bank.deploy();
    await bank.deployed();
    return bank;
  }

  async function deployAttacker(bankAddr) {
    const Atk = await ethers.getContractFactory(
      "contracts/security_patterns/01_reentrancy_attack/Attacker.sol:Attacker"
    );
    const atk = await Atk.deploy(bankAddr);
    await atk.deployed();
    return atk;
  }

  beforeEach(async () => {
    [attackerEOA, depositor] = await ethers.getSigners();
  });

  it("VulnerableBank gets drained by reentrancy", async () => {
    victim = await deployVulnerable();
    await victim.connect(depositor).deposit({ value: ethers.utils.parseEther("10") });

    attacker = await deployAttacker(victim.address);
    await attacker.connect(attackerEOA).attack({ value: ethers.utils.parseEther("1") });

    expect(await ethers.provider.getBalance(victim.address)).to.equal(0);
    expect(await ethers.provider.getBalance(attacker.address)).to.equal(
      ethers.utils.parseEther("11")
    );
  });

  it("SafeBank blocks reentrancy", async () => {
    victim = await deploySafe();
    await victim.connect(depositor).deposit({ value: ethers.utils.parseEther("10") });

    attacker = await deployAttacker(victim.address);
    await expect(
      attacker.connect(attackerEOA).attack({ value: ethers.utils.parseEther("1") })
    ).to.be.reverted;

    expect(await ethers.provider.getBalance(victim.address)).to.equal(
      ethers.utils.parseEther("10")
    );
  });
});

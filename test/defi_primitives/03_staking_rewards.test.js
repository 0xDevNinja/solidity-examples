const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("DeFi Primitives / Staking Rewards", function () {
  let stakingToken, rewardsToken, staking;
  let owner, alice, bob;
  const REWARD_RATE = ethers.utils.parseEther("1"); // 1 token per second
  const STAKE = ethers.utils.parseEther("100");

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const ERC = await ethers.getContractFactory(
      "contracts/defi_primitives/_helpers/TestERC20.sol:TestERC20"
    );
    stakingToken = await ERC.deploy("Stake", "STK");
    await stakingToken.deployed();
    rewardsToken = await ERC.deploy("Reward", "RWD");
    await rewardsToken.deployed();

    const Staking = await ethers.getContractFactory(
      "contracts/defi_primitives/03_staking_rewards/StakingRewards.sol:StakingRewards"
    );
    staking = await Staking.deploy(stakingToken.address, rewardsToken.address);
    await staking.deployed();

    // Fund the staker and the rewards pool.
    await stakingToken.mint(alice.address, STAKE);
    await stakingToken.mint(bob.address, STAKE);
    await rewardsToken.mint(staking.address, ethers.utils.parseEther("1000000"));

    await stakingToken.connect(alice).approve(staking.address, STAKE);
    await stakingToken.connect(bob).approve(staking.address, STAKE);

    await staking.connect(owner).setRewardRate(REWARD_RATE);
  });

  it("Accrues rewards proportional to time when single staker", async () => {
    await staking.connect(alice).stake(STAKE);

    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    const earned = await staking.earned(alice.address);
    // 100 seconds * 1 token/s = 100 tokens (allow 1s drift either side).
    expect(earned).to.be.gte(ethers.utils.parseEther("99"));
    expect(earned).to.be.lte(ethers.utils.parseEther("101"));
  });

  it("getReward transfers earned rewards", async () => {
    await staking.connect(alice).stake(STAKE);

    await network.provider.send("evm_increaseTime", [50]);
    await network.provider.send("evm_mine");

    const before = await rewardsToken.balanceOf(alice.address);
    await staking.connect(alice).getReward();
    const after = await rewardsToken.balanceOf(alice.address);

    const delta = after.sub(before);
    expect(delta).to.be.gte(ethers.utils.parseEther("50"));
    expect(delta).to.be.lte(ethers.utils.parseEther("52"));
    expect(await staking.rewards(alice.address)).to.equal(0);
  });

  it("Splits rewards across two stakers", async () => {
    await staking.connect(alice).stake(STAKE);
    await staking.connect(bob).stake(STAKE);

    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    const aliceEarned = await staking.earned(alice.address);
    const bobEarned = await staking.earned(bob.address);

    // Both should be ~50 tokens (half each of 100s * 1 token/s).
    expect(aliceEarned).to.be.gte(ethers.utils.parseEther("48"));
    expect(aliceEarned).to.be.lte(ethers.utils.parseEther("52"));
    expect(bobEarned).to.be.gte(ethers.utils.parseEther("48"));
    expect(bobEarned).to.be.lte(ethers.utils.parseEther("52"));
  });

  it("withdraw returns staked tokens and stops accrual on that portion", async () => {
    await staking.connect(alice).stake(STAKE);
    await network.provider.send("evm_increaseTime", [10]);
    await network.provider.send("evm_mine");

    await staking.connect(alice).withdraw(STAKE);
    expect(await stakingToken.balanceOf(alice.address)).to.equal(STAKE);
    expect(await staking.balanceOf(alice.address)).to.equal(0);
  });

  it("Only owner can set reward rate", async () => {
    await expect(
      staking.connect(alice).setRewardRate(REWARD_RATE)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});

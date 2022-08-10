const { expect } = require("chai");
const { ethers } = require("hardhat");

// Hash a (address, uint256) leaf the same way the contract does:
// keccak256(abi.encodePacked(address, uint256))
function leafHash(addr, amount) {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(["address", "uint256"], [addr, amount])
  );
}

// Hash an internal node: keccak256 of two sorted children concatenated.
function hashPair(a, b) {
  const [first, second] = a < b ? [a, b] : [b, a];
  return ethers.utils.keccak256(
    ethers.utils.concat([first, second])
  );
}

// Build a merkle tree from a list of leaves and return { root, proofs[] }.
// Uses the OZ-style sorted-pair hashing so MerkleProof.verify accepts proofs.
function buildTree(leaves) {
  if (leaves.length === 0) throw new Error("no leaves");

  // Pad layers by reusing the last node when the count is odd
  // (also OZ-compatible because both representations sort before hashing).
  let layer = leaves.slice();
  const layers = [layer];
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 === layer.length) {
        next.push(layer[i]);
      } else {
        next.push(hashPair(layer[i], layer[i + 1]));
      }
    }
    layer = next;
    layers.push(layer);
  }

  const root = layers[layers.length - 1][0];

  function proofFor(index) {
    const proof = [];
    let idx = index;
    for (let l = 0; l < layers.length - 1; l++) {
      const lvl = layers[l];
      const pairIdx = idx ^ 1;
      if (pairIdx < lvl.length) {
        proof.push(lvl[pairIdx]);
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  return { root, proofFor };
}

describe("DeFi Primitives / Merkle Airdrop", function () {
  let token, airdrop, alice, bob, carol, dan;
  let entries, tree;

  beforeEach(async () => {
    [alice, bob, carol, dan] = await ethers.getSigners();

    const ERC = await ethers.getContractFactory(
      "contracts/defi_primitives/_helpers/TestERC20.sol:TestERC20"
    );
    token = await ERC.deploy("Drop", "DRP");
    await token.deployed();

    entries = [
      { addr: alice.address, amount: ethers.utils.parseEther("100") },
      { addr: bob.address, amount: ethers.utils.parseEther("250") },
      { addr: carol.address, amount: ethers.utils.parseEther("75") },
    ];

    const leaves = entries.map((e) => leafHash(e.addr, e.amount));
    tree = buildTree(leaves);

    const Drop = await ethers.getContractFactory(
      "contracts/defi_primitives/01_merkle_airdrop/MerkleAirdrop.sol:MerkleAirdrop"
    );
    airdrop = await Drop.deploy(token.address, tree.root);
    await airdrop.deployed();

    // Fund the airdrop with the total claimable amount.
    const total = entries.reduce(
      (acc, e) => acc.add(e.amount),
      ethers.BigNumber.from(0)
    );
    await token.mint(airdrop.address, total);
  });

  it("Lets a listed account claim their allocation", async () => {
    const proof = tree.proofFor(1); // bob is index 1
    await airdrop.connect(bob).claim(entries[1].amount, proof);

    expect(await token.balanceOf(bob.address)).to.equal(entries[1].amount);
    expect(await airdrop.claimed(bob.address)).to.equal(true);
  });

  it("Reverts on double claim", async () => {
    const proof = tree.proofFor(0);
    await airdrop.connect(alice).claim(entries[0].amount, proof);

    await expect(
      airdrop.connect(alice).claim(entries[0].amount, proof)
    ).to.be.revertedWith("Already claimed");
  });

  it("Reverts on invalid proof (wrong amount)", async () => {
    const proof = tree.proofFor(2); // carol's proof
    await expect(
      airdrop.connect(carol).claim(ethers.utils.parseEther("999"), proof)
    ).to.be.revertedWith("Invalid proof");
  });

  it("Reverts when caller is not in the tree", async () => {
    const proof = tree.proofFor(0);
    await expect(
      airdrop.connect(dan).claim(entries[0].amount, proof)
    ).to.be.revertedWith("Invalid proof");
  });
});

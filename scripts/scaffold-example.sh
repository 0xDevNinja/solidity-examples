#!/usr/bin/env bash
# scaffold-example.sh — create a new Solidity example skeleton.
#
# Usage: ./scripts/scaffold-example.sh <area> <slug> <ContractName>
#
#   area          existing dir under contracts/ (e.g. defi_primitives)
#   slug          two-digit-prefixed dir name (e.g. 06_concentrated_amm)
#                 if omitted-prefix is given, next NN_ is computed automatically
#   ContractName  PascalCase contract identifier (e.g. ConcentratedAMM)
#
# Creates:
#   contracts/<area>/<slug>/<ContractName>.sol
#   test/<area>/<slug>/<ContractName>_test.js
# Appends an entry to README.md under the matching section header.
set -euo pipefail

if [ "$#" -ne 3 ]; then
  printf 'Usage: %s <area> <slug> <ContractName>\n' "$0" >&2
  exit 1
fi

AREA="$1"
SLUG="$2"
NAME="$3"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Validate area
if [ ! -d "contracts/$AREA" ]; then
  printf '[scaffold] area "%s" does not exist under contracts/. Existing areas:\n' "$AREA" >&2
  ls contracts/ >&2
  exit 1
fi

# Auto-prefix slug if missing
if ! [[ "$SLUG" =~ ^[0-9]{2}_ ]]; then
  MAX="$(ls "contracts/$AREA" 2>/dev/null \
    | grep -E '^[0-9]{2}_' \
    | sed -E 's/^([0-9]{2})_.*/\1/' \
    | sort -n | tail -1)"
  NEXT=$(( 10#${MAX:-00} + 1 ))
  PREFIX=$(printf '%02d' "$NEXT")
  SLUG="${PREFIX}_${SLUG}"
fi

CONTRACT_DIR="contracts/$AREA/$SLUG"
TEST_DIR="test/$AREA/$SLUG"
SOL_PATH="$CONTRACT_DIR/$NAME.sol"
TEST_PATH="$TEST_DIR/${NAME}_test.js"

if [ -e "$SOL_PATH" ]; then
  printf '[scaffold] %s already exists, refusing to overwrite.\n' "$SOL_PATH" >&2
  exit 1
fi

mkdir -p "$CONTRACT_DIR" "$TEST_DIR"

cat > "$SOL_PATH" <<EOF
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// $NAME — TODO: one-line description.

contract $NAME {
    // TODO: state

    constructor() {
        // TODO
    }

    // TODO: external interface
}
EOF

cat > "$TEST_PATH" <<EOF
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("$AREA / $SLUG / $NAME", function () {
  let contract, owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("$NAME");
    contract = await Factory.deploy();
    await contract.deployed();
  });

  it("deploys and sets owner", async function () {
    // TODO: assert initial state
    expect(contract.address).to.properAddress;
  });

  it.skip("reverts on unauthorized action", async function () {
    // TODO: replace with a real revert assertion
    await expect(contract.connect(user).someProtectedFn()).to.be.reverted;
  });
});
EOF

# Append to README under the matching section header. Section name is the
# Title Case of the area (e.g. defi_primitives -> "DeFi Primitives" — but
# README headings are stable and pre-existing, so we look up by snake-mapping).
declare -A SECTION
SECTION["account_abstraction"]="Account Abstraction"
SECTION["defi_primitives"]="DeFi Primitives"
SECTION["erc_standards"]="ERC Standards"
SECTION["governance"]="Governance"
SECTION["road_to_web3"]="Road to Web3"
SECTION["sample_apps"]="Sample Apps"
SECTION["security_patterns"]="Security Patterns"
SECTION["solidity_by_examples"]="Solidity By Examples"
SECTION["upgradeability"]="Upgradeability"

HEADER="${SECTION[$AREA]:-}"
if [ -n "$HEADER" ] && grep -q "^## $HEADER" README.md; then
  # Append to the end of the section: insert before the next `## ` or EOF.
  awk -v hdr="## $HEADER" -v line="N. [$NAME]($CONTRACT_DIR/)" '
    BEGIN { in_section = 0; appended = 0 }
    {
      if ($0 == hdr) { in_section = 1; print; next }
      if (in_section && /^## / && !appended) {
        print line
        print ""
        appended = 1
        in_section = 0
      }
      print
    }
    END {
      if (in_section && !appended) {
        print line
      }
    }
  ' README.md > README.md.tmp && mv README.md.tmp README.md
  printf '[scaffold] appended to README.md under "## %s"\n' "$HEADER"
else
  printf '[scaffold] no README section for area "%s"; add it manually.\n' "$AREA"
fi

printf '[scaffold] created:\n  %s\n  %s\n' "$SOL_PATH" "$TEST_PATH"
printf '[scaffold] next: edit the .sol skeleton, then run: npx hardhat compile\n'

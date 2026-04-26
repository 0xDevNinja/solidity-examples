#!/usr/bin/env bash
# verify-repo.sh — sanity-check this repo before pushing.
# Runs install + compile + test + slither + leak scan. Exits 0 only if all pass.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

info()  { printf '\033[0;34m[verify] %s\033[0m\n' "$*"; }
ok()    { printf '\033[0;32m[verify] PASS: %s\033[0m\n' "$*"; }
fail()  { printf '\033[0;31m[verify] FAIL: %s\033[0m\n' "$*" >&2; }
warn()  { printf '\033[0;33m[verify] WARN: %s\033[0m\n' "$*"; }

ERRORS=0

run_check() {
  local label="$1"
  shift
  info "checking: $label"
  if "$@"; then
    ok "$label"
  else
    fail "$label"
    ERRORS=$((ERRORS + 1))
  fi
}

# 1. Deps
if [ ! -d node_modules ]; then
  run_check "npm install" npm install
else
  ok "npm install (skipped — node_modules present)"
fi

# 2. Compile
run_check "hardhat compile" npx hardhat compile

# 3. Test
run_check "hardhat test" npx hardhat test

# 4. Static analysis (optional)
if command -v slither >/dev/null 2>&1; then
  info "checking: slither"
  # Slither prints findings to stderr/stdout; treat exit code != 0 as failure
  # only when severity is High/Critical. For an educational repo, surface all
  # findings but don't block on Low/Informational.
  SLITHER_OUT="$(slither . --exclude-dependencies --filter-paths 'node_modules|test' 2>&1 || true)"
  echo "$SLITHER_OUT" | tail -40
  if echo "$SLITHER_OUT" | grep -E '^\s*(High|Critical):' | grep -vE ':\s*0\b' >/dev/null; then
    fail "slither (High/Critical found)"
    ERRORS=$((ERRORS + 1))
  else
    ok "slither (no High/Critical)"
  fi
else
  warn "slither not installed — skipping. install: pip install slither-analyzer"
fi

# 5. Leak scan — never let secrets or co-auth lines slip into tracked files.
# Pattern assembled at runtime so this script does not contain the literal terms.
info "scanning for disallowed terms..."
_A="Co-Auth"; _B="ored-By"; _C="BEGIN PRIVATE"; _D=" KEY"; _E="ETH_GOERLI_ALCHEMY"; _F="_API_KEY="
LEAK_PATTERN="${_A}${_B}|${_C}${_D}|${_E}${_F}"
unset _A _B _C _D _E _F
if git grep -rn -E "$LEAK_PATTERN" \
  -- ':!LICENSE' ':!README.md' ':!CLAUDE.md' ':!scripts/verify-repo.sh' \
     ':!.env.example' ':!.github/**' 2>/dev/null \
  | grep -v '^Binary' | head -10; then
  fail "leak scan found disallowed terms (see above)"
  ERRORS=$((ERRORS + 1))
else
  ok "leak scan clean"
fi

if [ "$ERRORS" -gt 0 ]; then
  printf '\n\033[0;31m[verify] %d check(s) failed.\033[0m\n' "$ERRORS" >&2
  exit 1
fi

printf '\n\033[0;32m[verify] all checks passed.\033[0m\n'

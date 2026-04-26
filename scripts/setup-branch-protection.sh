#!/usr/bin/env bash
# setup-branch-protection.sh — apply branch protection on main.
# Idempotent. Requires gh CLI authenticated with repo admin scope.
#
# Usage:
#   ./scripts/setup-branch-protection.sh [--repo OWNER/REPO] [--dry-run]
set -euo pipefail

REPO="0xDevNinja/solidity-examples"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)    REPO="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; exit 1 ;;
  esac
done

info() { printf '\033[0;34m[branch-protect] %s\033[0m\n' "$*"; }
ok()   { printf '\033[0;32m[branch-protect] %s\033[0m\n' "$*"; }
dry()  { printf '\033[0;33m[branch-protect] DRY-RUN: %s\033[0m\n' "$*"; }

# Required CI status checks — must match job names in .github/workflows/ci.yml.
REQUIRED_CONTEXTS='["compile","test","slither"]'

apply_protection() {
  local branch="$1"
  local payload
  payload="$(cat <<JSON
{
  "required_status_checks": {
    "strict": false,
    "contexts": ${REQUIRED_CONTEXTS}
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
)"

  if "$DRY_RUN"; then
    dry "PUT /repos/${REPO}/branches/${branch}/protection"
    dry "payload: ${payload}"
    return
  fi

  printf '%s' "$payload" | gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "/repos/${REPO}/branches/${branch}/protection" \
    --input - >/dev/null
  ok "applied protection on ${branch}"
}

info "repo:   $REPO"
info "branch: main"
apply_protection main

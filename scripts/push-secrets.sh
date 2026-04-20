#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/push-secrets.sh
# Push all LoopBridge secrets to GitHub Actions from a local secrets.env file.
#
# Usage:
#   bash scripts/push-secrets.sh [path/to/secrets.env]
#
# Defaults to ./secrets.env relative to the repo root.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_FILE="${1:-$REPO_ROOT/secrets.env}"

# ── Validation ────────────────────────────────────────────────────────────────
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "❌  Secrets file not found: $SECRETS_FILE"
  echo "    Create it with:  cp secrets.env.template secrets.env"
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "❌  GitHub CLI (gh) not installed."
  echo "    Install: https://cli.github.com  or  brew install gh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "❌  Not authenticated to GitHub CLI."
  echo "    Run:  gh auth login"
  exit 1
fi

# ── Read repo from file or fall back to git remote ────────────────────────────
GITHUB_REPO=$(grep -E '^GITHUB_REPO=' "$SECRETS_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
if [[ -z "$GITHUB_REPO" ]]; then
  GITHUB_REPO=$(cd "$REPO_ROOT" && git remote get-url origin \
    | sed -E 's|.*github\.com[:/]||' \
    | sed 's/\.git$//')
  echo "ℹ️   GITHUB_REPO not set in secrets file — inferred: $GITHUB_REPO"
fi

echo "🔐  Pushing secrets to: $GITHUB_REPO"
echo ""

# ── The secrets to push (must match keys in secrets.env.template) ─────────────
KEYS=(
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  GOOGLE_CLIENT_ID
  SMTP_HOST
  SMTP_PORT
  SMTP_USER
  SMTP_PASS
  NEWSLETTER_FROM_EMAIL
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_WHATSAPP_FROM
  TWILIO_SMS_FROM
  JWT_SECRET
  LITESTREAM_ACCESS_KEY_ID
  LITESTREAM_SECRET_ACCESS_KEY
)

PUSHED=0
SKIPPED=0
FAILED=0

for KEY in "${KEYS[@]}"; do
  # Read value from secrets file (supports KEY=value and KEY="value" formats)
  VALUE=$(grep -E "^${KEY}=" "$SECRETS_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)

  if [[ -z "$VALUE" ]]; then
    echo "  ⏭️   SKIP   $KEY  (empty — fill in secrets.env first)"
    ((SKIPPED++)) || true
    continue
  fi

  if echo -n "$VALUE" | gh secret set "$KEY" --repo "$GITHUB_REPO" 2>/dev/null; then
    echo "  ✅  PUSHED  $KEY"
    ((PUSHED++)) || true
  else
    echo "  ❌  FAILED  $KEY"
    ((FAILED++)) || true
  fi
done

echo ""
echo "─────────────────────────────────────────────"
echo "  Pushed:  $PUSHED"
echo "  Skipped: $SKIPPED  (empty values)"
echo "  Failed:  $FAILED"
echo "─────────────────────────────────────────────"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "❌  Some secrets failed to push. Check your gh auth and repo access."
  exit 1
fi

if [[ $SKIPPED -gt 0 ]]; then
  echo ""
  echo "⚠️   $SKIPPED secret(s) were skipped because their values are empty."
  echo "    Fill them in secrets.env and re-run this script."
fi

echo ""
echo "✅  Done. Secrets are live on GitHub Actions."

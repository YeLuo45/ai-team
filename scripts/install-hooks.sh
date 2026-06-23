#!/usr/bin/env bash
# V50: install pre-commit hook into .git/hooks.
# Idempotent: overwrites existing hook.
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK_SRC="$PROJECT_ROOT/scripts/pre-commit"
HOOK_DST="$PROJECT_ROOT/.git/hooks/pre-commit"

if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "No .git directory at $PROJECT_ROOT; skip pre-commit install." >&2
  exit 0
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "Installed pre-commit hook → $HOOK_DST"
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm --version)" != "11.19.0" ]]; then
  npm install --global pnpm@11.19.0
fi
pnpm install --frozen-lockfile

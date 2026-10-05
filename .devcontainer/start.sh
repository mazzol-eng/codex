#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .data
umask 077
nohup pnpm demo:cloud >> .data/cloud-demo.log 2>&1 < /dev/null &
echo 'A demonstração está iniciando. Abra Ports → BotHub quando a porta 3000 estiver pronta.'

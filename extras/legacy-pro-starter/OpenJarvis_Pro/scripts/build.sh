#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
command -v node >/dev/null || { echo 'Node.js is missing. Run scripts/termux-setup.sh first.'; exit 1; }
npm install
node --check src/server.js
node --check ../web/app.js
echo 'OpenJarvis source checks passed. This script does not build an APK.'

#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
pkg update -y
pkg install -y nodejs-lts unzip
termux-setup-storage
echo "Prerequisites installed. Extract OpenJarvis.zip into ~/OpenJarvis, then:"
echo "  cd ~/OpenJarvis"
echo "  npm install"
echo "  cp .env.example .env"
echo "  npm run dev -- --host 0.0.0.0"

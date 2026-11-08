#!/data/data/com.termux/files/usr/bin/bash
set -e
pkg update -y
pkg install nodejs-lts git -y
cd "$(dirname "$0")/../backend"
npm install
echo "Backend dependencies installed. Copy .env.example to .env and add one provider API key."

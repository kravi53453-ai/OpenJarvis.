#!/data/data/com.termux/files/usr/bin/sh
# One-time setup for OpenJarvis in Termux. Safe to re-run. Asks before installing the optional offline engine.
set -e
echo "== OpenJarvis Termux setup =="
pkg update -y
pkg install -y nodejs-lts
node -v
cd "$(dirname "$0")/.."
[ -f .env ] || { cp .env.example .env; echo "Created .env (empty). Add keys in the app instead — they are stored safely in data/keys.json."; }
chmod 600 .env 2>/dev/null || true
printf "Install the OFFLINE engine (llama.cpp, ~100 MB)? Needed only for Offline Mode. [y/N] "
read ans || ans=n
case "$ans" in y|Y) pkg install -y llama-cpp ;; *) echo "Skipped. Install later with: pkg install llama-cpp" ;; esac
echo
echo "Done. Start OpenJarvis with:   cd $(pwd) && npm start"
echo "Then open  http://localhost:3000  in Chrome, or use the OpenJarvis Android app."
echo "Tip: run 'termux-wake-lock' so Android does not suspend the server."

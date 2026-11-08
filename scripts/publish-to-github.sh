#!/data/data/com.termux/files/usr/bin/sh
# Pushes this folder to YOUR GitHub repo from Termux (phone only). That push starts the APK build automatically.
# Before running: (1) create an EMPTY repo at github.com/new  (2) create a token (see docs/INSTALL_ON_PHONE.md).
# Your token is typed hidden, used only for this push, and is NOT saved in .git/config.
set -e
cd "$(dirname "$0")/.."
command -v git >/dev/null || pkg install -y git
printf "GitHub username: "; read GH_USER
printf "Repository name (empty repo you created): "; read GH_REPO
printf "GitHub token (hidden): "; stty -echo 2>/dev/null || true; read GH_TOKEN; stty echo 2>/dev/null || true; echo
[ -n "$GH_USER" ] && [ -n "$GH_REPO" ] && [ -n "$GH_TOKEN" ] || { echo "All three are required."; exit 1; }
export GH_USER GH_TOKEN
ASK="$(mktemp)"; trap 'rm -f "$ASK"; unset GH_TOKEN' EXIT
printf '#!/bin/sh\ncase "$1" in Username*) echo "$GH_USER";; *) echo "$GH_TOKEN";; esac\n' > "$ASK"; chmod 700 "$ASK"
[ -d .git ] || git init -q -b main
git config user.name  "${GH_USER}"
git config user.email "${GH_USER}@users.noreply.github.com"
git add -A
git commit -q -m "OpenJarvis" 2>/dev/null || echo "(nothing new to commit)"
GIT_ASKPASS="$ASK" GIT_TERMINAL_PROMPT=0 git push -u "https://github.com/${GH_USER}/${GH_REPO}.git" HEAD:main
echo
echo "Pushed. Now open: https://github.com/${GH_USER}/${GH_REPO}/actions   (the build starts by itself, ~5-10 min)"
echo "When it is green: https://github.com/${GH_USER}/${GH_REPO}/releases/latest  → tap OpenJarvis-debug.apk"

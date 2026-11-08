> **OUTDATED — kept for history only.** This describes the earlier prototype (browser demo, simulated phone). See the current README.md and docs/.

# Termux setup template — verify against the final project first

Do not run this template until the project's `package.json` and README confirm it is a Node/Vite project. In Termux:

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git unzip
termux-setup-storage
mkdir -p ~/OpenJarvis
cd ~/OpenJarvis
# Copy the ZIP into this folder using Android Files, then:
unzip -o OpenJarvis_Final.zip
cd oj_upgrade
npm install
cp .env.example .env
nano .env
npm run dev -- --host 0.0.0.0
```

Open the local URL printed by Vite in your phone browser. If the project uses a different folder name, package manager, or start script, follow the final verified README instead. Never paste real API keys into public source files or share them in chat. A web project running in Termux is not the same as an installable Android APK.

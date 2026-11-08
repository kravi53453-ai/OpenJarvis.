# Running OpenJarvis in Termux

1. Install **Termux from F-Droid** (the Play Store build is outdated).
2. Copy `OpenJarvis.zip` to the phone, then in Termux: `termux-setup-storage`, `cp ~/storage/downloads/OpenJarvis.zip ~ && unzip OpenJarvis.zip && cd OpenJarvis`.
3. `sh scripts/termux-setup.sh` (installs `nodejs-lts`; says yes/no to the optional `llama-cpp` offline engine).
4. `termux-wake-lock` (stops Android suspending the server) then `npm start`.
5. Open `http://localhost:3000` in Chrome — or install the Android app, which opens the same address.

Notes
* No `npm install` is needed to **run**; `dist/` and `dist-server/` are prebuilt. You only need `npm install` to rebuild (`npm run build`).
* Do not build the Android APK inside Termux — the Android SDK build tools do not run reliably there. Use a PC or GitHub Actions (`docs/ANDROID_APP.md`).
* Data (keys, settings, models) lives in `./data` (override with `OPENJARVIS_DATA`). Back it up before deleting the folder.
* Other devices on your Wi-Fi: `HOST=0.0.0.0 npm start` prints an access token; enter it in the web UI under Appearance & about → Connection. Plain `http` over Wi-Fi is not encrypted.
* Memory: the server idled around 57 MB and ~95 MB after 300 chat requests on a desktop Linux test with the JS heap capped at 48 MB. Real 2 GB phones were **not** measured.

Troubleshooting: `Cannot reach server` → server not running. Mic does nothing in Chrome → use `localhost`, allow the mic prompt, needs internet (Chrome speech service). Offline "llama-server not found" → `pkg install llama-cpp`.

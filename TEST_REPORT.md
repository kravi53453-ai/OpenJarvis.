# Test report
Environment: Linux x64 sandbox, Node 22, tsc 6.0.3, esbuild 0.28.2, Chromium 153 via Playwright. **No network, no API keys, no Android SDK/device.** Only results that actually ran are marked PASS.

| Check | Result | Detail |
|---|---|---|
| Production build (web + server) | **PASS** | `node scripts/build.mjs all`; 248 KB JS/CSS; dist 688 KB |
| TypeScript strict — server (shipped `tsconfig.server.json`) | **PASS** | exit 0 |
| TypeScript strict — web | **PASS (partial)** | run with *stubbed* React typings; real `@types/react` unavailable offline |
| Backend integration (`tests/backend.test.mjs`) | **PASS 58/58** | key lifecycle, masking, 0600, all 6 chat adapters + 2 TTS vs mock servers, tool round trips, offline mode isolation, validation, Origin/Host/traversal/CSP |
| Download manager (`tests/download.test.mjs`) | **PASS 13/13** | progress, pause, resume via HTTP Range, byte-identical file, SHA-256 verify + mismatch rejection, cancel, delete |
| LAN auth + low memory (`tests/lan-lowmem.test.mjs`) | **PASS 7/7** | token required off-loopback (5 checks); 300 real chat requests + 100 page loads with 48 MB heap cap: alive, RSS 57→95 MB |
| UI end-to-end, Chromium 360×640 (`tests/ui.test.mjs`) | **PASS 34/34** | status pill, providers flow, transcript, history sent, tool loop, memory, image attach, personas, persistence, theme, low-power, permissions (browser), offline switch, voice overlay, no overflow, no console errors |
| **Total automated checks that passed** | **112 / 112** | |
| ESLint | **NOT RUN** | not installed offline; command: `npx eslint .` after adding a config |
| `npm install` / lockfile | **NOT TESTED** | no network; `npm install` |
| Kotlin compile / Gradle build / APK | **NOT TESTED** | no Gradle, Kotlin compiler, JDK compiler (`javac`) or SDK. Attempt output: all tools MISSING. Run: `cd android && gradle wrapper --gradle-version 8.7 && ./gradlew assembleDebug` |
| GitHub Actions APK build | **NOT RUN** | sandbox cannot reach github.com / services.gradle.org / dl.google.com (all UNREACHABLE) and has no GitHub credentials, `gh`, Gradle, `kotlinc`, `javac` or SDK. The workflow YAML parses; `publish-to-github.sh` passes `sh -n`. Next step: `docs/INSTALL_ON_PHONE.md` |
| Kotlin manual compile review | **DONE (not a compile)** | 4 likely errors found and fixed (see CHANGELOG 1.0.1) |
| Kotlin static check | **PARTIAL** | bracket balance OK on 8 files; 6 XML files well-formed. Not a compile |
| Native permissions, accessibility, camera, calls, speech, screenshots on a device/emulator | **NOT TESTED** | no emulator/device |
| Real provider calls (Gemini, OpenAI, OpenRouter, DeepSeek, Claude, NIM, ElevenLabs) | **NOT TESTED** | no keys/network; use **Test connection** in the app |
| Real `llama-server` + model download from Hugging Face | **NOT TESTED** | no network/binary |
| Browser speech recognition / TTS audio output | **NOT TESTED** | no audio hardware; overlay and error paths only |
| Real Termux run, real 2 GB phone | **NOT TESTED** | desktop proxy only |

Re-run: `npm test` (backend, download, LAN/low-memory) and `npm run test:ui` (needs `npm i -D playwright && npx playwright install chromium`).

# OpenJarvis

A personal AI assistant (profile: **Ravi**) with two assistants — **Adam** (male) and **Kajal** (female) — a clean ChatGPT-style chat, voice mode with an animated orb, Light/Dark themes and a low-power mode for 2 GB phones.

It has two parts:

| Part | What it is | Status |
|---|---|---|
| **Server + web UI** (`server/`, `src/`, prebuilt in `dist*/`) | Runs in Termux (or any PC). Zero runtime dependencies. Cloud providers, Offline mode, model manager, chat, memory. | Built, type-checked and tested (see `TEST_REPORT.md`) |
| **Native Android app** (`android/`) | WebView shell + real Android features: AccessibilityService screen control, CameraX camera, calls, contacts, speech, screenshots, permissions. | **Written and reviewed but NOT yet compiled or tested** — no Android SDK/GitHub access was available to the author. Build it with GitHub Actions from your phone: **`docs/INSTALL_ON_PHONE.md`**. No APK is included. |

## Quick start (Termux)

```sh
# in Termux (install it from F-Droid)
unzip OpenJarvis.zip && cd OpenJarvis
sh scripts/termux-setup.sh      # installs Node.js, optionally the offline engine
npm start                       # no npm install needed: dist/ and dist-server/ are prebuilt
```
Open **http://localhost:3000** in Chrome (use `localhost`, not the LAN IP — browsers only allow the microphone there). Then: **Menu → Providers & API keys**, paste your own key, press **Test connection**.

Rebuild after changing code: `npm install && npm run build` (esbuild; no Vite/Tailwind native binaries).

## Cloud Mode and Offline Mode
Both are always visible in the header pill (e.g. `Cloud · Google Gemini · Connected` or `Offline · local model · Connected`). **OpenJarvis never switches between them or between providers by itself.** If a request fails you see the error.

* **Cloud** – providers with real server-side adapters: Gemini, OpenAI, OpenRouter, DeepSeek, Claude, NVIDIA NIM (chat + image + tools) and ElevenLabs (voice only). Each has Save / Test connection / Remove and a status: *Connected, Invalid key, Not configured, Connection error, Saved – not tested*. These adapters are tested against local mock servers only; real endpoints could not be reached from the build environment, so the **Test connection** button with your key is the real verification.
* **Offline** – chats only with a local OpenAI-compatible server (llama.cpp `llama-server`, or Ollama). **Menu → Offline mode & models** shows RAM/storage, a catalog of small GGUF models with fit verdicts, downloads with pause/resume and SHA-256 verification, and can start/stop `llama-server` (`pkg install llama-cpp`). On a 2 GB phone expect only ~0.5–1B models, slow, with weak tool use. No cloud key is used and cloud voice is disabled in this mode.

## API keys
You enter them in the app. They are stored on the device running the server in `data/keys.json` (mode 0600), never returned in full (only `••••1234`), never written to settings or logs, and only sent to the provider you chose. They are **not encrypted at rest** (protected by file permissions / Termux's private storage). Never put keys in the repo or ZIP; `.env` is git-ignored.

## Security defaults
Server binds to `127.0.0.1` only; Host-header (DNS-rebinding) and cross-origin checks; 6 MB body limit; input validation; rate limits; CSP; path-traversal protection. `HOST=0.0.0.0` (LAN) requires an access token (printed at start or `OPENJARVIS_TOKEN`).

## Documentation
`docs/INSTALL_ON_PHONE.md` (phone-only APK build + install) · `docs/TERMUX.md` · `docs/ANDROID_APP.md` · `docs/PERMISSIONS.md` · `docs/PROVIDERS.md` · `docs/LIMITATIONS.md` · `CHANGELOG.md` · `docs/AUDIT_FIX_MAP.md` · `TEST_REPORT.md`

## Layout
`server/` Node backend (TypeScript) · `src/` React UI · `public/assets/` logo + Adam/Kajal portraits · `android/` native app · `tests/` automated tests · `extras/` earlier prototype code, kept (legacy web UI, simulated VirtualPhone demo, Python/Termux starter, legacy Android stub) · `knowledge/` Craftland research (untouched) · `docs/ui-references/` design reference images · `docs/archive/` outdated docs.

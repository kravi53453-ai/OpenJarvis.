# The 33 approved findings → what was done
Legend: **DONE+TESTED** automated test passed · **DONE** implemented, checked by type-check/build/inspection only · **WRITTEN** code exists but could not be compiled/run · **PARTIAL** see note.

| # | Finding | Result |
|---|---|---|
| 1 | Gemini function-call follow-up | **DONE+TESTED** — full turn incl. original prompt, model functionCall (and thought signature) is sent back (mock) |
| 2 | Visible chat transcript + history | **DONE+TESTED** (Chromium) |
| 3 | PCM→WAV + voice fallback | **DONE+TESTED** WAV header/size; fallback to device voice with visible notice implemented. Real Gemini audio not tested |
| 4 | Camera preview / fake image fallback | **DONE** — fake fallback removed; browser uses the system camera/gallery picker; native live preview is **WRITTEN** (CameraX) |
| 5 | Termux startup / production runtime | **DONE** — prebuilt dist, zero runtime deps, no Vite dev server, localhost bind. Real Termux run not tested |
| 6 | Light/Dark, Ravi, Offline, ChatGPT-like UI | **DONE+TESTED** (Chromium). Offline needs a local server (see 29) |
| 7 | Server security | **DONE+TESTED** localhost bind, LAN token, Host/Origin checks, body limit, validation, rate limit, CSP, traversal |
| 8 | Real provider adapters | **DONE+TESTED against mocks only**; real endpoints untested |
| 9 | Fake seeds / false claims removed | **DONE+TESTED** (UI starts empty; honest status) |
| 10 | Mic/TTS conflicts, restart loops, state | **DONE** logic (mic closed while speaking, 3-empty-turn stop, errors stop loop); voice screen renders (tested); real mic untested |
| 11 | Configurable models | **DONE+TESTED** |
| 12 | No message loss while busy | **DONE+TESTED** |
| 13 | Image attach Adam+Kajal + downscale | **DONE+TESTED** → 1024 px JPEG |
| 14 | Send conversation history | **DONE+TESTED** |
| 15 | Memory storage + realistic limit | **DONE+TESTED** (256 KB cap shown) |
| 16 | Key protection + masking | **DONE+TESTED** 0600 file, masked, never in settings/GET; not encrypted at rest |
| 17 | .env.example / AI Studio leftovers | **DONE** |
| 18 | Dependencies, lockfile, strictness | **PARTIAL** — zero runtime deps; strict TS + noUnused on; lockfile needs network (`npm install`) |
| 19 | Unused imports/variables | **DONE** (enforced by tsc flags) |
| 20 | README server instructions | **DONE** |
| 21 | TERMUX_INSTALL_TEMPLATE | **DONE** → `docs/TERMUX.md` (old one archived) |
| 22 | PACKAGE_MANIFEST.json | **DONE** regenerated with sizes + SHA-256 |
| 23 | Exact duplicate files | **DONE** (identical PNG, prompt, brand SVGs removed) |
| 24 | Reference images out of production assets | **DONE** → `docs/ui-references/` (originals kept) |
| 25 | Animations/blur/GPU | **DONE** — no blur, no idle animation; orb pulses only in normal mode; low-power auto-enabled when RAM ≤ 2 GB |
| 26 | Lazy-load heavy screens | **DONE** (code-split chunks) |
| 27 | Honest permissions → real native | **DONE** (browser says it cannot) / **WRITTEN** (native) |
| 28 | Native Android project | **WRITTEN** — never compiled |
| 29 | Explicit Offline Mode | **DONE+TESTED vs mock server**; real llama-server/model untested |
| 30 | Working Light/Dark | **DONE+TESTED** |
| 31 | Profile name Ravi | **DONE+TESTED** |
| 32 | Cloud/Offline status indicator | **DONE+TESTED** |
| 33 | Model manager / cache | **DONE+TESTED** downloads (pause/resume/hash/cancel/delete/clear partials); starting llama-server with a real binary untested |

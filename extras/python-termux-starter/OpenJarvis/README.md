# OpenJarvis Termux Starter
Lightweight Python standard-library starter for Android/Termux and low-RAM devices.

## Run
```sh
pkg update -y
pkg install python -y
cd OpenJarvis
python app.py
```
Open http://127.0.0.1:8765 on the phone.

Optional device diagnostics: `pkg install termux-api` and install the matching Termux:API companion app.

## Features
Local chat UI/API, SQLite chat persistence, device diagnostics, syntax diagnostics, safe OTA staging with SHA-256 checks, YouTube public channel RSS reader, and Craftland blueprint JSON generation.

## Limits and safety
- A hash alone does not authenticate an update publisher. Production releases must verify a trusted digital signature before applying updates. This starter only stages files; it does not hot-swap code.
- No private ChatGPT/Gemini/Claude/DeepSeek model access without an authorized integration. Optional compatible endpoint is configured through environment variables.
- Social connectors are limited to public/documented resources and platform rules; no credential scraping, CAPTCHA bypass, or private-feed extraction.
- Android protected permissions cannot be bypassed. Accessibility automation requires a separately built Android AccessibilityService and explicit user consent.
- Craftland blueprints are planning files; this does not alter game binaries, cheat, or bypass protections.

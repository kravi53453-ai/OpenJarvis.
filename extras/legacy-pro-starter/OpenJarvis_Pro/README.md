# OpenJarvis — Mobile-first AI Assistant

**Simple outside. Powerful inside.** Designed to keep the foreground experience light on low-memory Android devices.

## Included
- Minimal home screen: OpenJarvis title, menu, voice shortcut, “How can I help?”, “Your personal AI assistant”, and the “Ask anything...” composer with plus, microphone and send.
- Separate Normal Chat and Voice Chat experiences.
- Animated, fluid voice orb with idle, listening, thinking and speaking states; Adam/Kajal character switch; mute, speaker and end controls.
- Adam and Kajal only; user messages are labelled `U`.
- Chat history stored locally in browser storage; settings and permission explainer.
- Node.js/Express backend adapters for Gemini, OpenAI, Claude and DeepSeek.
- Android manifest and AccessibilityService starter, permissions matrix, architecture, limitations and test plan.
- Termux setup and build helper scripts.

## Run in Termux
1. Install Termux from a trusted source and open it.
2. Run `bash scripts/termux-setup.sh` from the extracted project folder.
3. In `backend`, copy `.env.example` to `.env` and add your provider key. Keep `.env` private.
4. Run `npm start` inside `backend`.
5. Open `http://127.0.0.1:3000` in the phone browser. The backend serves the web interface and `/api/chat`.

Or run `bash scripts/build.sh` from the project root to install backend dependencies and check JavaScript syntax. It does not create an Android APK.

## Voice mode — honest capability note
The animated voice screen is implemented in the frontend. In browsers that support the Web Speech API, speech recognition and speech synthesis provide turn-based voice chat using the configured `/api/chat` provider. Browser/device support and Hindi voice availability vary. This is **not** a low-latency, full-duplex Gemini Live session; true Gemini Live streaming requires a separate authenticated realtime integration and supported audio transport. The orb animation remains available even when speech APIs are unavailable.

## Android / phone control
The Android directory is an integration starter, not a complete native Android application. AccessibilityService and manifest declarations do not grant permission or automatically make every phone action work. The user must enable Android permissions manually. Complete and test native Kotlin UI, service lifecycle, action confirmation, target-app compatibility and signing before distributing an APK.

## Important limitations
- This ZIP is a source project, not a ready-to-install APK.
- AI chat requires a valid provider API key and internet access; providers may charge separately.
- Browser speech support depends on Android browser/WebView and installed speech services.
- File selection currently sends filenames as context; it does not yet upload or parse file bytes.
- Runtime API keys entered in Settings are held in backend memory until the backend restarts. For persistent deployment, use server-side environment variables and a proper authenticated secret store. Never commit `.env`.
- The 2GB RAM target is addressed by a lightweight web UI and on-demand API calls; no large local model is bundled.
- Phone automation, SMS/calls, social-media publishing, cloud builds, app generation and APK packaging require further native/service integrations and user confirmations. Do not assume these are already operational.

## Security
Never expose provider keys in frontend code, never run arbitrary shell commands from chat, and require explicit confirmation for sensitive actions such as publishing, sending messages, deleting files or changing account settings.

# Known limitations (read this)
**Not done / not verified**
* **No APK.** The Android project was never compiled (no SDK/Gradle/Kotlin compiler/network available). Kotlin was checked only for bracket balance and XML well-formedness. Real-device behaviour of accessibility control, camera, calls, speech, screenshots and permissions is **untested**.
* Real provider APIs, real Gemini/ElevenLabs audio, real `llama-server` + model downloads from Hugging Face (catalog URLs/sizes unverified) were **not** exercised. Offline Mode was tested against a mock OpenAI-compatible server only.
* ESLint was not run (not installed offline); strict TypeScript with `noUnusedLocals/Parameters` was used instead. Web type-check used stub React typings (real `@types/react` could not be installed); run `npm install && npm run typecheck` for the real check.
* No `package-lock.json` (needs network); `npm install` creates it. Runtime has zero npm dependencies.
* UI tests ran in desktop Chromium at 360×640, not in a real Android WebView. 2 GB RAM behaviour was approximated on desktop Linux (capped heap), not on a phone.

**By design / Android**
* Keys are stored in a 0600 file, not encrypted. Chat history and memory are plain browser storage on the device.
* Browser version cannot do phone control; it says so. VirtualPhone (simulation) was removed from the product and archived in `extras/virtual-phone-demo/`.
* Browser voice input needs Chrome + internet + `localhost`. Android secure screens, background app launches, clipboard, call-answer detection and screenshot consent are limited by Android (see `docs/ANDROID_APP.md`).
* Tiny offline models are slow and unreliable with tools; "supports tools/images" toggles are for you to set.

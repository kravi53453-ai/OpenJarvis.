# OpenJarvis Android app (native)

**Status: source code only. It has not been compiled or run** (the authoring environment had no Android SDK, Gradle, Kotlin compiler or network). Expect to fix a few compile errors or version bumps on the first build. No APK is included, and none should be trusted until you have built and tested one.

## What it does (once built and permitted)
A WebView shell loads the OpenJarvis UI from the server (`http://127.0.0.1:3000` by default — plain http is allowed only for localhost) and exposes a bridge (`OJNative`) to:

| Capability | Implementation |
|---|---|
| Screen control | `JarvisAccessibilityService` (`canRetrieveWindowContent`, `canPerformGestures`): read UI tree (passwords hidden), tap/long-press by text or coordinates, swipe, scroll, type into fields (never password fields), Back/Home/Recents/Notifications |
| Multi-step tasks | The model loop (max 10 steps) runs in the UI with live step list, error reporting, a Stop button, and a **foreground notification with Stop** while phone tools run |
| Open apps | Launcher-app lookup by name (`<queries>`, no `QUERY_ALL_PACKAGES`) |
| Camera | `CameraActivity` (CameraX): live preview, photo + video, front/rear, flash/torch, zoom, view + save-to-gallery, visible REC timer, optional visible 3-second countdown |
| Calls & contacts | Contact search (`READ_CONTACTS`); a **confirmation dialog shows name + number**; `ACTION_CALL` only if `CALL_PHONE` is granted, else the dialer opens; short/emergency numbers always use the dialer. Reports "call requested", never "connected" |
| Voice | Android `SpeechRecognizer` (mic closed while speaking; no restart storms) and `TextToSpeech` (pitch/voice per persona) |
| Screenshots | `MediaProjection` with Android's own consent each time + visible notification |
| Other | Notifications, clipboard, share sheet, open link, file picker, last-known location, Bluetooth on/off + paired names |

Every permission is requested separately with an explanation (Menu → Android permissions); status is read from Android, not assumed.

## Build it
**A. GitHub Actions, phone only (recommended):** follow `docs/INSTALL_ON_PHONE.md` — `scripts/publish-to-github.sh` uploads the project, the workflow builds `OpenJarvis-debug.apk` and attaches it to a Release you can tap to download. (Workflow never run yet.)
**B. PC with Android Studio:** open the `android/` folder, let it sync (SDK 34), *Build → Build APK(s)*.
**C. Command line on a PC:** install JDK 17 + Android SDK 34 (`ANDROID_HOME`), then `cd android && gradle wrapper --gradle-version 8.7 && ./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`. (The Gradle wrapper JAR is not included because it could not be generated offline.)

Pinned versions you may need to bump: AGP 8.5.2, Kotlin 1.9.24, CameraX 1.3.4, activity-ktx 1.9.1, core-ktx 1.13.1, exifinterface 1.3.7.

## Install and enable
1. Install the APK (allow "install unknown apps" for your file manager).
2. Start the server in Termux (`npm start`). If it is not running the app shows a "server not reachable" page with Retry.
3. Follow the permission onboarding. **Accessibility:** Android Settings → Accessibility → Installed apps → OpenJarvis → On. On Android 13+ for a sideloaded APK, Android first blocks it: Settings → Apps → OpenJarvis → ⋮ → **Allow restricted settings**, then enable it.
4. First checks to run on a real device: open app → permission statuses correct → "open WhatsApp" → "read the screen" → camera → "call <contact>" shows the confirm dialog → mic voice mode.

## Real limits (Android's, not bugs)
Secure windows (banking, lock screen, some payment screens) return nothing to accessibility; password fields are hidden; apps can block gestures. Starting apps from the background is restricted by Android 10+, so `open_app` works best while OpenJarvis is on screen. The clipboard can only be read by the foreground app. Screenshots need consent every time and OpenJarvis moves itself to the background to capture the other app. No hidden camera/mic use is possible or attempted. Speech recognition may need internet on your phone.

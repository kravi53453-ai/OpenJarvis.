# Install OpenJarvis from this repository using an Android phone

## 1. Build the current source on GitHub

1. Open this repository on GitHub and select branch `work/complete-android-voice-apk` (or the branch you want to test).
2. Open **Actions → OpenJarvis Android APK**.
3. Select **Run workflow**, choose your branch, and start it. A push or pull request touching app/source files also starts the workflow.
4. Wait for both jobs to finish successfully. If the Android job fails, download **OpenJarvis-android-build-log** and inspect the final Gradle error.
5. Download **OpenJarvis-debug-APK**. It contains `OpenJarvis-debug.apk` and its SHA-256 checksum.
6. Download **OpenJarvis-complete-source** separately for the source ZIP.

The checked-in root `OpenJarvis.apk` may be an older artifact. Prefer the APK produced by the successful workflow run for the exact branch commit you tested.

## 2. Install and start

1. Download the APK artifact to your phone and extract it if GitHub provides it as an archive.
2. Open `OpenJarvis-debug.apk`. If Android asks, allow your browser or file manager to install unknown apps. This is a debug APK, not a Play Store release.
3. The Android app is a native shell around the OpenJarvis web UI. Start the backend separately in Termux:
   ```sh
   cd ~/OpenJarvis
   termux-wake-lock
   npm start
   ```
   Complete the Termux setup once using `sh scripts/termux-setup.sh`.
4. Open OpenJarvis. Its default backend is `http://127.0.0.1:3000`. If the server is not running, the app cannot load the chat UI.
5. Choose Offline mode and configure a supported local model server if you want no API key. A model must be downloaded/installed separately; the app does not magically include a capable model.

## 3. Optional Android control permissions

Grant only permissions you intend to use. Screen interaction requires manually enabling OpenJarvis under Android Settings → Accessibility. Android may require **Allow restricted settings** for a sideloaded app on newer Android versions.

Calls require confirmation and Android permissions. Screenshots require Android's own screen-capture consent. Secure windows, password fields, background-launch restrictions and some app-specific protections cannot be bypassed.

## 4. Voice reality check

Adam and Kajal are persona choices in the UI. Android uses the speech-recognition service and text-to-speech voices installed on the phone; the available voice, accent and gender selection depend on that engine. Speech recognition may need internet unless a compatible offline language pack is installed and selected. Test with network disabled before relying on offline voice.

## 5. First device checks

- Launch app with Termux backend running.
- Test a text chat in Offline mode with a local model.
- Test microphone permission and speech input.
- Test Adam and Kajal playback and check the actual installed voice selected.
- Test one harmless Accessibility action after explicitly enabling the service.
- Test Stop and revoke permissions afterwards.

A green CI build means compilation/package steps succeeded; it does not mean these real-device checks passed.

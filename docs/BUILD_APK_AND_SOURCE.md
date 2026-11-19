# Build OpenJarvis APK and source ZIP from GitHub

This repository's Android app is under `android/`. The workflow uses GitHub-hosted Ubuntu, JDK 17, Android SDK 34 and Gradle 8.7. A Gradle wrapper script/JAR is not committed, so the workflow installs Gradle on the runner.

## Start a build

1. Push this branch or open a pull request, or go to **Actions → OpenJarvis Android APK → Run workflow** and select the branch.
2. Open the latest workflow run. The **Build Android debug APK** job must finish successfully.
3. Download the **OpenJarvis-debug-APK** artifact for the installable debug APK and its SHA-256 checksum.
4. Download **OpenJarvis-complete-source** for the source ZIP.
5. If the build fails, download **OpenJarvis-android-build-log** and inspect the final Gradle error.

The APK is a debug build, not a Play Store-signed release. Install only builds from your own repository and review Android's unknown-app installation warning.

## Important limitations

A successful CI build proves compilation and packaging only. It does not prove voice recognition works offline, that Adam/Kajal have distinct natural voices on every Android TTS engine, or that phone automation works on a particular device. Those need real-device checks and user-granted Android permissions. SpeechRecognizer may use an online recognition service; install an offline speech pack and test it with network disabled before calling voice fully offline.

The workflow uploads artifacts; it does not silently publish a public release or modify the default branch.

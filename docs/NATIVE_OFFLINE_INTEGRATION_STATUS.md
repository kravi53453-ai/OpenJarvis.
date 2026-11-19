# Native offline integration status

This branch is a CI checkpoint, not a completed native-offline release.

The local working snapshot has Android-native LiteRT model management and an in-process Android API bridge, but those files have not yet been synchronized into this GitHub branch. The existing Android workflow will build the source currently committed here only. Any APK from that workflow is therefore a baseline CI artifact and must not be described as the completed offline APK.

Outstanding before release:
- Synchronize and review the native Android source changes.
- Build the APK from that exact source tree.
- Verify the Qwen3 model download and LiteRT initialization.
- Test chat, knowledge retrieval, voice and Android permissions on the target handset.

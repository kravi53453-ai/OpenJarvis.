# Known limitations of this starter
- The HTML preview is not a native Android app and cannot itself grant Android permissions.
- The Android directory contains integration examples, not a complete Gradle wrapper/project; an Android engineer or app-building agent must create the full Android Studio project and test it.
- Accessibility service is intentionally a safe stub. It does not tap arbitrary screens yet.
- Voice input uses browser SpeechRecognition where available; production voice conversation requires native audio capture, speech/TTS provider integration and lifecycle handling.
- File attachments are selected in the UI and their names are passed to the backend; binary file upload, OCR, image understanding and document parsing are not yet implemented.
- Backend provider adapter names/models may change. Verify current provider model availability and terms before release.
- No Google Search integration is included; add a supported Search API/connector with its own credentials and source citations.
- No unlimited/free API usage is promised. Provider billing, quotas and terms apply.

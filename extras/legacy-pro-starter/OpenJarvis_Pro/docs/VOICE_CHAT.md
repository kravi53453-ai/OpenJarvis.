# Voice Chat UX

Voice chat is a separate full-screen mode from Normal Chat. It uses a fluid, morphing orb with continuously rotating contour rings rather than a static circular button. CSS states: `idle`, `listening`, `thinking`, and `speaking`. Speech recognition captures one user turn; the configured chat backend returns a response; speech synthesis reads it aloud. Controls include mic mute, speaker mute, character switch (Adam/Kajal), and end.

Browser SpeechRecognition and SpeechSynthesis availability varies by browser, OS, language pack and device. This implementation is turn-based and is not equivalent to a realtime full-duplex Gemini Live API session. A future native/realtime implementation should use the provider's documented streaming audio API, secure short-lived credentials, interruption handling, VAD, and lifecycle-safe foreground audio service.

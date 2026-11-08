> **OUTDATED — kept for history only.** This describes the earlier prototype (browser demo, simulated phone). See the current README.md and docs/.

# OpenJarvis — Features & Limits

## UI
- Mobile-first premium dark UI with blue/cyan accents.
- Companion switcher includes only Kajal and Adam; Riya and Priya removed.
- Home screen uses the selected companion portrait and voice/chat controls.
- 3D Avatar button, viewer component and TalkingHead dependency removed.

## Menu pages
- Home Companion
- Virtual Phone OS
- Permissions & Access
- API Keys & Providers
- Memory

## API key settings
- Gemini (currently connected to `/api/chat`)
- OpenAI, OpenRouter, DeepSeek, Claude/Anthropic, NVIDIA NIM, Groq
- ElevenLabs, Google Cloud/TTS
- YouTube Data API, Web Search, Google Maps, GitHub

Except Gemini, these optional fields only save configuration locally in this version. Their providers are not activated until corresponding backend integrations are added. Do not assume a key is working just because it was saved.

## Permissions
The checklist covers microphone, camera, accessibility service, notifications, overlay, battery optimization, app info, phone/calls, contacts, SMS/messaging, location, photos/files, calendar/reminders, nearby devices/Bluetooth and usage access.

A browser cannot grant native Android permissions. Native special access such as Accessibility, display-over-apps, phone/SMS and background operation must be implemented in a native Android app/wrapper and approved by the user in Android Settings.

## Security
Browser localStorage is not a secure secret store. Use backend environment variables or a proper secure vault before production use. Never commit real API keys.

# OpenJarvis — Claude Master Build Prompt (ZIP + Kajal/Adam Images + UI Reference)

You are a senior full-stack engineer, Android/Termux deployment specialist, AI integration engineer, and premium mobile UI/UX designer. First inspect the entire uploaded OpenJarvis ZIP and every supplied image. Do not assume the project structure or claim features work without verifying the code.

## Inputs
- Existing OpenJarvis ZIP: treat this as the project to audit and improve, not as a disposable reference.
- Kajal portrait image: female assistant identity.
- Adam portrait image: male assistant identity.
- `openjarvis_clean_neon_ui_reference.png`: visual direction for the interface.

## 1. Design target
Build a premium, clean, professional mobile-first interface: near-black/navy glass panels, restrained cyan/blue neon with subtle purple accents, crisp typography, generous spacing, accessible contrast, polished chat bubbles, a subtle glow, and responsive layouts. Keep it elegant rather than cluttered. Use the supplied Kajal and Adam portraits faithfully; show only these two characters as assistant identities. Remove Riya and Priya references from UI, labels, selectors, sample data, and code where they are assistant identities. Remove the old 3D avatar implementation and unnecessary 3D libraries.

IMPORTANT: The home screen must NOT show visible shortcut tiles/icons for Google/Gemini, Create App/Build & Code, Calculator, Games, Websites, Termux, AI Tools, Tools, or More Apps. These capabilities should remain available through natural-language commands and/or the menu, but hidden from the main home screen. The home screen should focus on Kajal and Adam, a welcoming status/header, the conversation area, New Chat, History, Clear Chat, a message composer, microphone/voice controls, and a settings/menu entry. Keep Settings, API Settings, Permissions, Build & Code, and other utilities in the drawer/menu, not as a grid of home-screen tiles.

Use the reference image for styling and composition, not as a literal screenshot to copy. Produce a real responsive UI, not a static image. Do not include incorrect generated text baked into the interface.

## 2. Kajal and Adam
- Kajal: female assistant identity and a distinct suitable female voice.
- Adam: male assistant identity and a distinct suitable male voice.
- Allow switching between them; save their voice, language, and conversation preferences separately.
- Support Hindi, Hinglish, and English.
- Use the provided portrait files; do not invent or substitute faces. If the ZIP already contains `ui_kajal.webp` and `ui_adam.webp`, inspect them and preserve/replace only if the user-provided reference images are better.
- Animation is optional. Prioritize a stable, lightweight interface over unverified 3D animation.

## 3. Normal chat and voice
Implement working text chat, conversation history, new/clear chat, copy response/code, loading/error states, voice input/output where supported, mute/stop controls, and clear provider/network error handling. Never fake an AI response or show a provider as connected unless a real request succeeds. Keep the normal chat experience useful even when coding features or voice are unavailable.

## 4. Command-driven Build & Code
The user should be able to type plain-language requests such as:
- “Make a calculator app.”
- “Build a playable Snake game.”
- “Create a responsive business website.”
- “Create a notes app.”
- “Write a Python script for Termux.”
- “Fix this error and update my project.”

When a build request is detected, produce a complete project where practical: plan, file tree, full source files, dependency manifest, run commands, and an exportable project/ZIP when the application supports file generation. For small web apps, create runnable HTML/CSS/JS. For larger apps, create a structured project and state the exact prerequisites. Add a code editor/preview/export flow only if it can be implemented in the existing architecture. Do not claim generated code has been executed, tested, installed, or deployed unless the action actually succeeded. Treat code from users and AI as untrusted; do not silently execute arbitrary shell commands.

## 5. API configuration and security
Audit the existing provider/backend implementation. Add real, documented integrations where feasible for Gemini, OpenAI, OpenRouter, DeepSeek, Anthropic Claude, NVIDIA NIM, Groq, and ElevenLabs. Support custom compatible endpoints only when the API protocol actually matches. Provide masked API key inputs, save/delete, model selection where supported, connection tests, status, and meaningful errors. Do not hard-code secrets or put server keys in frontend bundles. Use server-side environment variables and provide `.env.example` with placeholders only. Clearly mark unsupported/unimplemented providers instead of pretending they work. Respect each provider’s terms, pricing, rate limits, and model availability.

## 6. Permission Center and Android integration
Create a truthful permission center for the features the app actually implements: microphone, camera, notifications, files/media, contacts, phone/call, SMS (only where eligible and allowed), calendar, location, Bluetooth, and accessibility. Explain why a permission is needed and show granted/denied/not-requested/unsupported states. Ask only at point of use. A web app cannot grant Android permissions by itself: for native-only features, implement the appropriate Android layer or clearly list what remains. Do not bypass Android restrictions, silently read personal data, or claim permissions work because a toggle exists. Accessibility must be explicitly enabled by the user in Android settings.

## 7. Termux-first install and run instructions
After inspecting the actual project and its stack, create a separate `termux-install.sh` (and/or a copy-paste `TERMUX_INSTALL.md`) with safe, accurate commands for Android Termux. Include required package installation, dependency installation, environment setup, and the correct start command for this project. Make it idempotent where practical, check errors, never delete user files, never use `sudo`, and never run destructive commands. If the project is a web app rather than a native Android APK, say so clearly and explain how to run it locally in Termux and open it in the mobile browser. Do not claim Termux can install a ZIP as an Android app. If native APK output is not supported by the current toolchain, explain the exact build path and limitations.

## 8. Quality and testing
1. Inventory the ZIP and identify framework, scripts, routes, dependencies, backend, and assets.
2. Preserve useful existing features and user data.
3. Remove broken code and unused 3D dependencies only after confirming they are unused.
4. Implement the new clean UI and hidden command-driven capabilities.
5. Check imports, type errors, dependency scripts, API routes, and security issues.
6. Run available lint/build/tests; report exact commands and real outcomes.
7. Fix errors that can be reproduced.
8. Do not replace working features with a static mockup or a prompt-only implementation.

## 9. Deliverables
Return a new, independently named complete ZIP, not merely a patch. Include source, required supplied images/assets, `.env.example`, README, `FEATURES_AND_LIMITS.md`, the Termux install script/instructions, and this master prompt. Do not include real API keys, node_modules, caches, or personal secrets. Include:
- what was changed;
- what is verified working;
- build/test logs or precise results;
- provider integrations that were actually tested;
- Android permissions/native functions still incomplete;
- exact Termux commands;
- known limitations and any next steps.

Start by inspecting all uploaded files and the ZIP. Then implement, validate, and package the improved project. Ask a question only if an essential input is genuinely missing; otherwise use reasonable defaults and document them.

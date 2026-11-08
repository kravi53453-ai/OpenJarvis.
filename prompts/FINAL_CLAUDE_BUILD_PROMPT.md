# OPENJARVIS — FINAL CLAUDE BUILD PROMPT (ZIP + TWO UI IMAGES)

## YOUR TASK
Act as a senior software engineer, Android engineer, AI integration engineer, UI/UX designer, and build/release engineer. First inspect ALL files in the uploaded OpenJarvis ZIP and BOTH supplied UI reference images. Then produce a new, corrected, complete project ZIP. Do not merely give advice or a mockup.

## INPUTS
- `OpenJarvis` source project ZIP: inspect its real framework, source, package files, assets, backend, and existing features.
- `UI_REFERENCE_KAJAL.png`: preferred main dashboard composition; Kajal is the currently shown assistant.
- `UI_REFERENCE_ADAM.png`: matching alternate dashboard; Adam is the currently shown assistant.

Treat the images as design references, not as a request to use a flat screenshot as the app UI. Build a real responsive interface with actual components. Keep both character choices, but display only the selected character's name in the active greeting: “Hello! I am Kajal” OR “Hello! I am Adam”. Welcome copy: “Welcome to OpenJarvis. I am Kajal/Adam, your personal AI assistant. Ask me anything.” No King/crown branding or crown icons. Brand is OpenJarvis only.

## DESIGN REQUIREMENTS
- Premium dark navy/black glass UI with restrained electric-blue and violet neon edges; clean, legible, professional, mobile-first.
- Use supplied Kajal and Adam images as portrait assets; keep them separate and label them correctly. Do not invent a different identity.
- Keep the clean central chat layout: sidebar/menu, selected character greeting, chat history, New Chat, Clear Chat, message composer, microphone, send/stop controls, Settings, API Settings, Permissions, Build & Code, Termux Help, About.
- Do NOT show separate home-screen tiles/icons for Google/Gemini, Create App, Calculator, Games, Websites, Termux, AI Tools, or More Apps. These capabilities should be hidden from the home dashboard and accessible through natural-language commands or the appropriate menu.
- Provide a Character selector for Kajal and Adam. Persist selection. Give Kajal a configured female voice and Adam a configured male voice; never silently swap them. If the selected voice is unavailable, show a clear error or use an explicitly configured fallback.
- Remove legacy Riya/Priya identities and old 3D-avatar implementation/dependencies where safe. Do not remove unrelated working features accidentally.
- Support Hindi, Hinglish, and English; responsive layout and low-memory behavior on lower-end Android devices.

## FUNCTIONAL REQUIREMENTS
1. Normal AI chat: conversation history, new/clear chat, copy response/code, loading and error states, text input, optional voice input/output, stop-speaking controls.
2. Build & Code mode: when asked for a calculator, small game, website, or app, generate a complete file tree and code files, package/dependency instructions, preview for supported web projects, validation where possible, and exportable project ZIP. Support iterative fixes. Never claim code was run or tested unless it actually was.
3. Termux assistance: generate Python/Node.js and other appropriate code, safe setup/run commands, and troubleshooting. Do not claim direct control of Termux unless a real authorized integration exists. Explain before destructive commands.
4. API Settings: Gemini, OpenAI, OpenRouter, DeepSeek, Claude/Anthropic, NVIDIA NIM, Groq, ElevenLabs, and custom compatible endpoints where technically supported. Implement actual server-side provider adapters, model configuration, test connection, errors, and optional fallback. Do not show a provider as connected unless a real test succeeds. Keep secrets out of frontend bundles, public assets, and Git. Use `.env.example` with placeholders, never real keys.
5. Permissions Center: accurately show requested/granted/denied/unsupported status. Explain each permission and request it only when a feature needs it. Web permission UI cannot grant native Android permissions. For microphone/camera/notifications use supported browser APIs; for calls, SMS, contacts, background services, and Accessibility, document and implement native Android integration only if the existing framework supports it. Follow Android restrictions and user consent; never bypass protections or claim unsupported permissions work.
6. Security: validate inputs, avoid exposing API secrets, keep `.env` ignored, and document any sensitive capabilities. Ask for confirmation before destructive actions.

## REQUIRED WORKFLOW — DO NOT SKIP
A. Inspect the whole source ZIP and both images. Identify the actual stack and current limitations before changing code.
B. Make a concise implementation plan, then carry it out in the project.
C. Preserve useful existing features; fix broken imports, dependency issues, and configuration errors.
D. Implement the actual UI with image assets, not a screenshot-only page. Ensure the two character cards switch the active portrait, greeting, and voice configuration.
E. Run the available install/build/lint/tests. Fix errors that can be reproduced. If a command cannot be run, state why and do not claim success.
F. Package a NEW downloadable ZIP with source, assets, README, `.env.example`, build instructions, and a changelog. Exclude `node_modules`, caches, real secrets, and unnecessary huge files.
G. Include a clear `TERMUX_INSTALL.md` with commands matched to the actual stack, including extraction, dependency install, `.env` setup, development run, production build, and troubleshooting. Do not assume generic commands fit if package files say otherwise.
H. Explain the APK path honestly. If the project is a web app, do not claim `npm build` creates an APK. Use a suitable Android wrapper such as Capacitor only if compatible and configure Android project/build steps. State whether APK compilation requires Android SDK/Gradle or cloud build; give exact Termux-compatible steps only if they genuinely work. Do not promise Termux alone can compile every APK.

## FINAL DELIVERABLES
Return the new ZIP as a downloadable artifact, and report: actual stack; implemented features; build/test commands and results; provider integrations actually tested; permissions/native work still missing; and exact next steps to build/run on Android/Termux. Do not stop at a plan. Do not fabricate test results or claim all features work if they are only UI placeholders.

> **OUTDATED — kept for history only.** This describes the earlier prototype (browser demo, simulated phone). See the current README.md and docs/.

# OpenJarvis — Build & Code Mode

When you ask Kajal or Adam to build something, write naturally in chat, for example:
- `एक calculator website बनाओ`
- `HTML में playable snake game बनाओ`
- `Termux में Python chatbot का code और install commands दो`
- `मेरे लिए responsive portfolio website बनाओ`
- `इस error को ठीक करो: ...`

The assistant's server prompt is configured to return complete, runnable code with filenames and exact run commands. For simple web prototypes, it should prefer a single HTML file with inline CSS/JavaScript so it is easy to save and open on a phone. For Termux projects, it should provide commands that are safe to copy/paste and explain what each important command does.

## Important boundaries
- Chat generation does not itself install or execute code on the phone.
- A web app cannot control Termux or Android settings just because permissions are listed in its UI. Native Android integration and explicit user approval are required.
- Only Gemini is connected to `/api/chat` in this build. Other provider keys shown in settings are stored locally for future integrations and are not automatically active.
- Do not paste real API keys into chats or source code. Use environment variables on a trusted backend.

# Architecture

- `web/`: lightweight mobile-first chat UI prototype.
- `backend/`: Express API and provider adapter starter.
- `android/`: native Android permission/accessibility integration starter, not a complete Gradle app.
- `docs/`: implementation, permission, test and handoff requirements.

Recommended production split:
1. Android native shell (Kotlin) handles permissions, secure storage, foreground status and approved automation actions.
2. Web/Compose UI presents chat, history, character selection and tool controls.
3. Backend brokers AI providers, validates tool calls, rate-limits requests and redacts secrets.
4. Automation agent plans tasks, but a deterministic allow-listed executor performs actions and verifies outcomes.

> **OUTDATED — kept for history only.** This describes the earlier prototype (browser demo, simulated phone). See the current README.md and docs/.

# OpenJarvis

Consolidated source package assembled from OpenJarvis project files and references available in this conversation's Library.

## Main application
The default application is a mobile-first React + Vite + Express + TypeScript project at the repository root.

### Run in Termux
Requirements: Termux, Node.js 20+ (or compatible current Node LTS), npm, and internet access for dependency installation.

```bash
pkg update
pkg install nodejs-lts unzip
termux-setup-storage
cd ~/OpenJarvis
npm install
cp .env.example .env
# Add GEMINI_API_KEY locally if you want Gemini chat.
npm run dev -- --host 0.0.0.0
```

Open the local URL printed in Termux in your phone browser. Production web build:

```bash
npm run build
```

This is web-app source. A ZIP is not an installable APK. Native Android packaging and a complete AccessibilityService/device-control bridge are not delivered as a finished APK here.

## Included
- React/Vite frontend, app screens, styles, TypeScript services.
- Express/TypeScript backend (`server.ts`).
- OpenJarvis logo, Kajal and Adam portraits, UI references.
- `.env.example` placeholders only; no private API keys.
- Master build prompt and UI design reference PDF.
- Craftland research bundle (partial; manifest lists unverified/missing fields).
- Earlier Python/Termux starter and compact React/Express starter in `extras/` for reference.

## Real integration status
- Gemini is the only provider connected to the main chat endpoint in this snapshot.
- Other provider fields are placeholders and do not mean those providers are implemented or connected.
- Browser localStorage is not a secure secret vault. Keep production secrets server-side.
- The permissions screen is explanatory/checklist UI; a web app cannot grant Android system permissions.
- Virtual Phone is a demo UI, not a real Android OS controller.
- Build & Code prompts can generate code but do not themselves execute, install, or deploy it on the phone.

## Structure
- `src/`, `public/`: main frontend and assets.
- `server.ts`: backend entry point.
- `prompts/`: build prompts.
- `docs/`: limits and design references.
- `knowledge/craftland-research/`: partial Craftland research.
- `extras/python-termux-starter/`: separate lightweight Python local starter.
- `extras/legacy-pro-starter/`: earlier standalone prototype; not the default app.

## Verification
The archive is assembled and ZIP integrity is checked. It is not represented as a successful production build or a fully tested Android APK. Run `npm install`, `npm run lint`, and `npm run build` in Termux and inspect any errors.

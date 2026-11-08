# Test plan / release gate

## Frontend
- [ ] Opens at 320px, 360px, 412px and tablet widths without horizontal overflow.
- [ ] Adam/Kajal selection persists; exactly one persona responds.
- [ ] User messages are labelled `U`; profile name is `Ravi`.
- [ ] Enter sends; Shift+Enter inserts newline.
- [ ] Attachment picker, image picker and microphone graceful failure states work.
- [ ] Clear chat requires confirmation; history survives reload.
- [ ] Modal closes with close button and backdrop.
- [ ] No console errors on supported browsers.

## Backend
- [ ] `/api/health` works.
- [ ] Missing API key returns actionable error.
- [ ] Each provider adapter tested with a valid key in a secure environment.
- [ ] Invalid JSON, oversized request, rate-limit and provider timeout tested.
- [ ] Secrets are not returned in responses or logged.
- [ ] Production CORS allowlist, TLS and authentication configured before public deployment.

## Android
- [ ] Test on Android versions targeted by release.
- [ ] Permission rationale, denial and revoke flows work.
- [ ] Accessibility service only runs after explicit user enablement.
- [ ] Stop button halts queued actions immediately.
- [ ] Sensitive actions require confirmation.
- [ ] Test on 2 GB RAM device for memory, startup, battery and thermal behavior.
- [ ] Test app background/foreground, process death, network loss and rotation.

# Android native integration blueprint

The `web/` UI is a web frontend starter. To ship a real Android application, wrap it in a native Android project (recommended: Kotlin + AndroidX WebView or a full native Compose UI). The following must be implemented and tested in Android Studio before claiming device-control support.

## Permission and service design
- Request each runtime permission only when a user invokes a feature that needs it.
- Accessibility: implement an `AccessibilityService`, show a clear explanation screen, and send the user to Android Accessibility Settings. The user must manually enable it.
- Screen capture: use Android MediaProjection consent flow; do not capture silently.
- Notifications: request notification listener access separately; explain exactly what is read.
- Microphone/camera/location/contacts/phone/SMS/storage: use Android's current runtime permission model and respect Play policy restrictions.
- Background execution: use foreground services only for eligible, user-visible tasks and show a persistent notification.
- Provide a global Stop action and a visible automation status indicator.

## Example manifest
See `app/src/main/AndroidManifest.xml`. It is a template, not a complete production manifest. Confirm every permission against current Android and Play policies.

## Accessibility limitations
Accessibility can inspect and interact with accessible UI nodes, but it cannot guarantee control of every app or every screen. Secure screens, protected content, custom-rendered canvases, permission prompts, biometric dialogs and app-specific restrictions may block automation. Sensitive actions need confirmation.

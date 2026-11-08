# Android permissions — what and why
Declared in `android/app/src/main/AndroidManifest.xml`. Nothing is requested at install time except `INTERNET`; runtime permissions are asked one by one and can all be skipped.

| Permission | Why | If you skip it |
|---|---|---|
| INTERNET | Talk to the OpenJarvis server (localhost) | App cannot work |
| RECORD_AUDIO | Voice commands; sound in videos | Type instead; videos are silent |
| CAMERA | In-app camera with visible preview | No camera tool |
| READ_CONTACTS | Find a number for "call Mom" | Say the number instead |
| CALL_PHONE | Place a call after you confirm | Dialer opens; you press call |
| ACCESS_FINE/COARSE_LOCATION | Only if you ask "where am I" | No location tool |
| POST_NOTIFICATIONS | Reminders you request | No notifications |
| BLUETOOTH_CONNECT (≤ API 30: BLUETOOTH) | Bluetooth on/off + paired names, no scanning | No Bluetooth tool |
| FOREGROUND_SERVICE (+ _MEDIA_PROJECTION, _SPECIAL_USE) | Screen capture and a visible "working" notification with Stop | No screenshots; task may pause in background |
| Accessibility service (a setting, not a permission) | Real screen control | No screen control |

Not requested on purpose: SMS, storage/media, overlay, usage access, device admin, `QUERY_ALL_PACKAGES`, background location, background camera/mic.
Re-enable later: Android Settings → Apps → OpenJarvis → Permissions (the in-app screen shows the live status and opens the right page).

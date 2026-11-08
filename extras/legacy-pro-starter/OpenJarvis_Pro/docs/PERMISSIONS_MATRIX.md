# Android permissions matrix (implementation checklist)

| Capability | Android mechanism | User action / caveat |
|---|---|---|
| Microphone | RECORD_AUDIO runtime permission | Ask when voice is first used |
| Camera | CAMERA runtime permission | Ask when camera feature is used |
| Photos/media | Photo Picker / media permissions as applicable | Prefer scoped Photo Picker |
| Files | Storage Access Framework | User chooses files/folders |
| Accessibility automation | AccessibilityService + BIND_ACCESSIBILITY_SERVICE | Explain purpose; user manually enables in Settings |
| Screen reading/capture | MediaProjection | System consent prompt for each session |
| Notifications | Notification Listener access | User manually enables; explain private notification data |
| Contacts | READ_CONTACTS / WRITE_CONTACTS if required | Ask only for contact feature |
| Calls | ACTION_DIAL preferred; CALL_PHONE only if necessary | Confirm recipient/action |
| SMS | SMS permissions restricted by Play policy | Prefer system SMS intent; default SMS role may be required |
| Location | Fused/location permissions | Ask only for location feature |
| Background task | Foreground service / WorkManager | Android restrictions apply; show status |
| App usage | Usage Access special settings | User manually grants; use only if needed |

There is no universal permission that grants unlimited control over a phone. Android version, OEM behavior, target app and distribution policy affect availability.

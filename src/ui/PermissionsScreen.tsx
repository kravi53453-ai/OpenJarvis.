import { useCallback, useEffect, useState } from 'react';
import { getPermissions, isNative, onNativeEvent, openAppSettings, requestPermission } from '../lib/native';
import type { PermState } from '../lib/native';
import type { Prefs } from '../lib/prefs';
import Frame, { Badge } from './Frame';

interface Item { id: string; title: string; why: string; later: string; special?: string }
const ITEMS: Item[] = [
  { id: 'microphone', title: 'Microphone', why: 'Voice commands and voice mode, and sound in videos you record. OpenJarvis only listens while the screen shows the listening orb.', later: 'Android Settings → Apps → OpenJarvis → Permissions → Microphone.' },
  { id: 'camera', title: 'Camera', why: 'Lets you (or a voice command) open the in-app camera to take photos and videos. A visible preview is always shown; there is no hidden capture.', later: 'Settings → Apps → OpenJarvis → Permissions → Camera.' },
  { id: 'contacts', title: 'Contacts', why: 'Finds a contact’s number when you say “call Mom”. Contacts are read only when you ask and are not uploaded except what you choose to send in a chat.', later: 'Settings → Apps → OpenJarvis → Permissions → Contacts.' },
  { id: 'phone', title: 'Phone calls', why: 'Lets OpenJarvis start a call after YOU confirm the number on a dialog. Without it, the dialer opens with the number filled in and you press call.', later: 'Settings → Apps → OpenJarvis → Permissions → Phone.' },
  { id: 'location', title: 'Location', why: 'Only used if you ask for your location. Reads the last known position.', later: 'Settings → Apps → OpenJarvis → Permissions → Location.' },
  { id: 'notifications', title: 'Notifications', why: 'Shows reminders/notifications you ask for and the notice while screen capture is active.', later: 'Settings → Apps → OpenJarvis → Notifications.' },
  { id: 'bluetooth', title: 'Nearby devices (Bluetooth)', why: 'Lets OpenJarvis report whether Bluetooth is on and the names of paired devices. No scanning.', later: 'Settings → Apps → OpenJarvis → Permissions → Nearby devices.' },
  { id: 'accessibility', title: 'Accessibility service (screen control)', special: 'This is the most powerful permission. With it OpenJarvis can read what is on screen (password fields are hidden) and tap, swipe and type in other apps when you give a command. You can press Stop in the app at any time, and switch it off in Android settings. Android may block it in banking/secure apps. On Android 13+ for a sideloaded APK you may first need: Settings → Apps → OpenJarvis → ⋮ → “Allow restricted settings”.', why: 'Needed for real phone control: opening apps, tapping, scrolling, typing.', later: 'Settings → Accessibility → Installed apps → OpenJarvis → turn on.' },
  { id: 'screen_capture', title: 'Screen capture', why: 'Taking a screenshot uses Android’s own screen-capture consent. Android asks each time; there is nothing to grant in advance.', later: 'Nothing to set up; Android shows its prompt when a screenshot is requested.' },
];
const LABEL: Record<PermState, string> = { granted: 'Allowed', not_granted: 'Not allowed', on_request: 'Asks each time', unsupported: 'Not on this Android version' };

export default function PermissionsScreen({ prefs, setPrefs, onBack, onboarding, onDone }: { prefs: Prefs; setPrefs: (p: Prefs) => void; onBack: () => void; onboarding: boolean; onDone: () => void }) {
  const [perm, setPerm] = useState<Record<string, PermState>>({});
  const refresh = useCallback(() => setPerm(getPermissions()), []);
  useEffect(() => {
    refresh();
    const off = onNativeEvent(e => { if (e.type === 'permissions_changed') refresh(); });
    const vis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', vis); window.addEventListener('focus', refresh);
    return () => { off(); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', refresh); };
  }, [refresh]);
  const skip = (id: string) => setPrefs({ ...prefs, skipped: prefs.skipped.includes(id) ? prefs.skipped : [...prefs.skipped, id] });
  const finish = () => { setPrefs({ ...prefs, onboarded: true }); onDone(); };

  if (!isNative()) return (
    <Frame title="Android permissions" onBack={onBack}>
      <div className="card"><h3>Browser version</h3><p>You are using OpenJarvis in a web browser (for example Chrome via Termux). Browsers cannot grant Android permissions such as screen control, calls or contacts, and OpenJarvis does not pretend otherwise here.</p>
        <p>Install the OpenJarvis Android app (see README → “Build the Android app”) to enable real phone control. Voice input in the browser uses Chrome’s own microphone prompt on http://localhost.</p></div>
    </Frame>);

  return (
    <Frame title="Android permissions" onBack={onboarding ? finish : onBack}>
      <div className="note">{onboarding ? 'OpenJarvis asks for each permission separately. Allow only what you want — you can skip any and change it later.' : 'Real status read from Android. Changes you make in Android settings appear here when you come back.'}</div>
      <button className="btn sm" onClick={() => requestPermission('all_runtime')}>Allow all standard permissions at once…</button>
      {ITEMS.map(it => { const s = perm[it.id] ?? 'not_granted'; const ok = s === 'granted' || s === 'on_request'; return (
        <div className="card" key={it.id}>
          <div className="row sp"><h3>{it.title}</h3><Badge kind={ok ? 'ok' : prefs.skipped.includes(it.id) ? 'warn' : undefined}>{!ok && prefs.skipped.includes(it.id) ? 'Skipped' : LABEL[s]}</Badge></div>
          <p>{it.why}</p>{it.special && <div className="warnbox">{it.special}</div>}
          {!ok && s !== 'unsupported' && <div className="row"><button className="btn primary sm" onClick={() => requestPermission(it.id)}>{it.id === 'accessibility' ? 'Open Accessibility settings' : 'Allow'}</button>{!prefs.skipped.includes(it.id) && <button className="btn sm" onClick={() => skip(it.id)}>Skip</button>}</div>}
          {ok && it.id !== 'screen_capture' && <div className="row"><button className="btn sm" onClick={() => (it.id === 'accessibility' ? requestPermission('accessibility') : openAppSettings())}>Manage in Android settings</button></div>}
          <div className="note">To change later: {it.later}</div>
        </div>); })}
      {onboarding && <button className="btn primary" onClick={finish}>Continue to OpenJarvis</button>}
    </Frame>
  );
}

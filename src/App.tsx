import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { api } from './lib/api';
import { newMsg, runAgent } from './lib/agent';
import type { RunCtl } from './lib/agent';
import { isNative, onNativeEvent, readImage, stopAutomation } from './lib/native';
import { applyPrefs, loadPrefs, savePrefs } from './lib/prefs';
import type { Prefs } from './lib/prefs';
import { speak, stopSpeaking } from './lib/speech';
import { load, saveSoon } from './lib/storage';
import type { Msg, PersonaId, ProviderCard, Settings, Status } from './lib/types';
import Chat from './ui/Chat';
import Drawer from './ui/Drawer';
import type { Screen } from './ui/Drawer';
import VoiceMode from './ui/VoiceMode';

const Providers = lazy(() => import('./ui/ProvidersScreen'));
const Offline = lazy(() => import('./ui/OfflineScreen'));
const Permissions = lazy(() => import('./ui/PermissionsScreen'));
const Memory = lazy(() => import('./ui/MemoryScreen'));
const SettingsScreen = lazy(() => import('./ui/SettingsScreen'));

const CHAT_KEY = 'oj_chat_v2';
const MAX_SAVED = 80;

export default function App() {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [screen, setScreen] = useState<Screen>(() => (isNative() && !loadPrefs().onboarded ? 'permissions' : 'chat'));
  const [drawer, setDrawer] = useState(false);
  const [voice, setVoice] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => load<Msg[]>(CHAT_KEY, []));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [pendingImage, setPendingImage] = useState('');
  const [toast, setToast] = useState('');
  const ctl = useRef<RunCtl>({ stopped: false });
  const msgsRef = useRef<Msg[]>(msgs); msgsRef.current = msgs;
  const busyRef = useRef(false);

  const setPrefs = useCallback((p: Prefs) => { setPrefsState(p); savePrefs(p); }, []);
  const say = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast(''), 3500); }, []);

  useEffect(() => {
    applyPrefs(prefs);
    if (prefs.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)'); const f = () => applyPrefs(prefs);
    mq.addEventListener('change', f); return () => mq.removeEventListener('change', f);
  }, [prefs]);

  // History is saved without images (keeps storage small), debounced.
  useEffect(() => { saveSoon(CHAT_KEY, () => msgsRef.current.slice(-MAX_SAVED).map(m => ({ ...m, image: undefined }))); }, [msgs]);

  const refresh = useCallback(async () => {
    try {
      const [s, st, pr] = await Promise.all([api.settings(), api.status(), api.providers()]);
      setSettings(s); setStatus(st); setProviders(pr); setStatusError('');
    } catch (e) { setStatusError(e instanceof Error ? e.message : 'Server unreachable'); }
  }, []);
  useEffect(() => { void refresh(); const v = () => { if (document.visibilityState === 'visible') void refresh(); }; document.addEventListener('visibilitychange', v); return () => document.removeEventListener('visibilitychange', v); }, [refresh]);
  useEffect(() => { if (screen === 'chat') void refresh(); }, [screen, refresh]);

  // Native camera finished: show the real captured photo and make it attachable.
  useEffect(() => onNativeEvent(e => {
    if (e.type === 'stop_requested') { ctl.current.stopped = true; stopSpeaking(); say('Stopped.'); return; }
    if (e.type !== 'camera_result' && e.type !== 'screenshot_result') return;
    const path = String(e.path || ''); const kind = String(e.kind || 'photo');
    if (!path) { say('Camera closed without saving.'); return; }
    if (kind === 'photo' || e.type === 'screenshot_result') { const d = readImage(path, 1024); if (d) setPendingImage(d); say(e.type === 'screenshot_result' ? 'Screenshot ready to send.' : 'Photo saved. You can send it to the assistant.'); } else say('Video saved.');
  }), [say]);

  const cloudVoice = !!settings && settings.mode === 'cloud' && settings.tts.provider !== 'device';

  const send = useCallback(async (text: string, image?: string): Promise<string> => {
    if (busyRef.current) return ''; // never drop or double-send while busy
    busyRef.current = true; setBusy(true); ctl.current = { stopped: false };
    const user = newMsg('user', text, { image });
    const base = [...msgsRef.current, user]; setMsgs(base);
    let final = '';
    try { final = await runAgent(base, prefs.persona, m => setMsgs(p => [...p, m]), ctl.current); }
    finally { busyRef.current = false; setBusy(false); void refresh(); }
    return final;
  }, [prefs.persona, refresh]);

  const sendTyped = useCallback((text: string, image?: string) => {
    void send(text || 'What is in this image?', image).then(reply => {
      if (prefs.speakReplies && reply && !voice) void speak(reply, prefs.persona, cloudVoice).then(r => { if (r.notice) say(r.notice); });
    });
  }, [send, prefs.speakReplies, prefs.persona, voice, cloudVoice, say]);

  const stopAll = useCallback(() => { ctl.current.stopped = true; stopAutomation(); stopSpeaking(); }, []);

  const setMode = async (mode: 'cloud' | 'offline') => { try { await api.saveSettings({ mode }); await refresh(); } catch (e) { say(e instanceof Error ? e.message : 'Failed'); } };
  const setProvider = async (id: string) => { try { await api.saveSettings({ provider: id }); await refresh(); } catch (e) { say(e instanceof Error ? e.message : 'Failed'); } };
  const back = () => setScreen('chat');
  const fallback = <div className="empty">Loading…</div>;

  return (
    <>
      {screen === 'chat' && <Chat msgs={msgs} busy={busy} persona={prefs.persona} status={status} statusError={statusError} pendingImage={pendingImage} setPendingImage={setPendingImage}
        onSend={sendTyped} onStop={stopAll} onMenu={() => setDrawer(true)} onVoice={() => setVoice(true)} onToast={say} />}
      <Suspense fallback={fallback}>
        {screen === 'providers' && <Providers onBack={back} onChanged={refresh} />}
        {screen === 'offline' && <Offline onBack={back} onChanged={refresh} />}
        {screen === 'permissions' && <Permissions prefs={prefs} setPrefs={setPrefs} onBack={back} onboarding={isNative() && !prefs.onboarded} onDone={back} />}
        {screen === 'memory' && <Memory onBack={back} />}
        {screen === 'settings' && <SettingsScreen prefs={prefs} setPrefs={setPrefs} onBack={back} onClearChat={() => { setMsgs([]); say('Chat history cleared.'); }} />}
      </Suspense>
      {drawer && <Drawer status={status} providers={providers} persona={prefs.persona} screen={screen} busy={busy} onClose={() => setDrawer(false)} onGo={setScreen}
        onPersona={(p: PersonaId) => setPrefs({ ...prefs, persona: p })} onMode={setMode} onProvider={setProvider} onNew={() => { stopAll(); setMsgs([]); }} />}
      {voice && <VoiceMode persona={prefs.persona} lang={prefs.voiceLang} cloudVoice={cloudVoice} send={t => send(t)} onClose={() => setVoice(false)} onStopAll={stopAll} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { getToken, setToken } from '../lib/api';
import { getBackendUrl, isNative, nativeVersion, setBackendUrl } from '../lib/native';
import type { Prefs } from '../lib/prefs';
import Frame from './Frame';

const LANGS: [string, string][] = [['hi-IN', 'Hindi (India)'], ['en-IN', 'English (India)'], ['en-US', 'English (US)']];
export default function SettingsScreen({ prefs, setPrefs, onBack, onClearChat }: { prefs: Prefs; setPrefs: (p: Prefs) => void; onBack: () => void; onClearChat: () => void }) {
  const [tok, setTok] = useState(getToken()); const [url, setUrl] = useState(getBackendUrl());
  return (
    <Frame title="Appearance & about" onBack={onBack}>
      <div className="card"><h3>Appearance</h3>
        <div className="seg" role="group" aria-label="Theme">{(['system', 'light', 'dark'] as const).map(t => <button key={t} className={prefs.theme === t ? 'on' : ''} onClick={() => setPrefs({ ...prefs, theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
        <label className="note"><input type="checkbox" checked={prefs.lowPower} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefs({ ...prefs, lowPower: e.target.checked })} /> Low-power mode (no animations, lighter effects — recommended for 2 GB phones)</label>
      </div>
      <div className="card"><h3>Voice</h3>
        <label className="l" htmlFor="vl">Speech recognition language</label>
        <select id="vl" className="field" value={prefs.voiceLang} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPrefs({ ...prefs, voiceLang: e.target.value })}>{LANGS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
        <label className="note"><input type="checkbox" checked={prefs.speakReplies} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefs({ ...prefs, speakReplies: e.target.checked })} /> Also read typed-chat replies aloud</label>
        <div className="note">Speech recognition may use Google’s online service on most phones, even in Offline Mode, unless an offline language pack is installed in Android. Voice mode always speaks replies.</div>
      </div>
      <div className="card"><h3>Connection</h3>
        {isNative() ? <><label className="l" htmlFor="bu">Server address (the OpenJarvis server running in Termux)</label><input id="bu" className="field" value={url} onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)} />
          <button className="btn sm" onClick={() => { setBackendUrl(url); }}>Save & reload</button><div className="note">Default http://127.0.0.1:3000 (this phone). Plain http is only allowed for 127.0.0.1/localhost.</div></>
          : <><label className="l" htmlFor="tk">Access token (only needed when opening this page from another device on your network)</label><input id="tk" className="field" type="password" autoComplete="off" value={tok} onChange={(e: ChangeEvent<HTMLInputElement>) => setTok(e.target.value)} /><button className="btn sm" onClick={() => { setToken(tok.trim()); location.reload(); }}>Save</button></>}
      </div>
      <div className="card"><h3>Data</h3><button className="btn danger sm" onClick={() => { if (confirm('Delete the whole chat history on this device?')) onClearChat(); }}>Clear chat history</button></div>
      <div className="card"><h3>About OpenJarvis</h3>
        <div className="note">Profile: Ravi · {isNative() ? `Android app ${nativeVersion()}` : 'Web version'}</div>
        <div className="note"><b>Honest limits:</b> Phone control, calls, camera and screenshots work only in the Android app and only after you grant the permissions. Android blocks accessibility control in some secure screens (banking, lock screen, password fields). Calls always need your on-screen confirmation, and OpenJarvis cannot tell whether the other person answered. Offline models are small and slow on 2 GB phones. Only the providers shown as “Connected” in Providers have been verified with your key.</div>
      </div>
    </Frame>
  );
}

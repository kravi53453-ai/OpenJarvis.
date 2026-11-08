import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, ApiError } from '../lib/api';
import type { KeyStatus, ProviderCard, Settings } from '../lib/types';
import Frame, { Badge } from './Frame';

const LABEL: Record<KeyStatus, string> = { connected: 'Connected', invalid_key: 'Invalid key', not_configured: 'Not configured', error: 'Connection error', untested: 'Saved – not tested' };
const KIND: Record<KeyStatus, 'ok' | 'err' | 'warn' | undefined> = { connected: 'ok', invalid_key: 'err', not_configured: undefined, error: 'err', untested: 'warn' };

export default function ProvidersScreen({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const [cards, setCards] = useState<ProviderCard[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { const [c, s] = await Promise.all([api.providers(), api.settings()]); setCards(c); setSettings(s); setErr(''); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed to load'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const upd = (c: ProviderCard) => { setCards(cs => cs.map(x => x.id === c.id ? c : x)); onChanged(); };
  const run = async (id: string, label: string, f: () => Promise<void>) => { setBusy(id); setMsg(m => ({ ...m, [id]: label })); try { await f(); } catch (e) { setMsg(m => ({ ...m, [id]: e instanceof ApiError ? e.message : 'Failed' })); } finally { setBusy(''); } };

  const save = (c: ProviderCard) => run(c.id, 'Saving…', async () => {
    const k = (keys[c.id] || '').trim(); const m = models[c.id];
    if (!k && m === undefined) { setMsg(x => ({ ...x, [c.id]: 'Nothing to save.' })); return; }
    upd(await api.saveProvider(c.id, { ...(k ? { key: k } : {}), ...(m !== undefined ? { model: m } : {}) }));
    setKeys(x => ({ ...x, [c.id]: '' })); setMsg(x => ({ ...x, [c.id]: k ? 'Saved. Now press Test connection.' : 'Saved.' }));
  });
  const test = (c: ProviderCard) => run(c.id, 'Testing…', async () => { const r = await api.testProvider(c.id); upd(r); setMsg(x => ({ ...x, [c.id]: r.message })); });
  const remove = (c: ProviderCard) => { if (!confirm(`Remove the saved ${c.label} key?`)) return; return run(c.id, 'Removing…', async () => { upd(await api.deleteKey(c.id)); setMsg(x => ({ ...x, [c.id]: 'Key removed.' })); }); };
  const useForChat = (c: ProviderCard) => run(c.id, '', async () => { await api.saveSettings({ provider: c.id, mode: 'cloud' }); await load(); onChanged(); });

  const tts = settings?.tts;
  const saveTts = async (patch: unknown) => { try { setSettings(await api.saveSettings({ tts: patch })); onChanged(); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed'); } };

  return (
    <Frame title="Providers & API keys" onBack={onBack}>
      <div className="note">Enter your own keys. They are stored only on the device running the OpenJarvis server (file permissions 0600), shown masked, and never sent to other devices or back to this screen in full.</div>
      {err && <div className="warnbox">{err}</div>}
      {cards.map(c => (
        <div className="card" key={c.id}>
          <div className="row sp"><h3>{c.label}</h3><Badge kind={KIND[c.status]}>{LABEL[c.status]}</Badge></div>
          {c.configured && <div className="note">Key: {c.masked} {c.source === 'env' ? '(from server environment)' : ''}</div>}
          <div><label className="l" htmlFor={`k-${c.id}`}>API key — {c.keyHelp}</label>
            <input id={`k-${c.id}`} className="field" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={c.configured ? 'Paste a new key to replace' : 'Paste key'} value={keys[c.id] || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setKeys(x => ({ ...x, [c.id]: e.target.value }))} /></div>
          {c.isChat && <div><label className="l" htmlFor={`m-${c.id}`}>Model (default: {c.defaultModel})</label>
            <input id={`m-${c.id}`} className="field" autoCapitalize="off" spellCheck={false} value={models[c.id] ?? c.model} onChange={(e: ChangeEvent<HTMLInputElement>) => setModels(x => ({ ...x, [c.id]: e.target.value }))} /></div>}
          <div className="row">
            <button className="btn primary sm" disabled={busy === c.id} onClick={() => save(c)}>Save</button>
            <button className="btn sm" disabled={busy === c.id || !c.configured} onClick={() => test(c)}>Test connection</button>
            {c.configured && c.source === 'app' && <button className="btn sm danger" disabled={busy === c.id} onClick={() => remove(c)}>Remove</button>}
            {c.isChat && <button className="btn sm" disabled={!c.configured || busy === c.id || settings?.provider === c.id && settings?.mode === 'cloud'} onClick={() => useForChat(c)}>{settings?.provider === c.id ? 'Selected for chat' : 'Use for chat'}</button>}
          </div>
          {msg[c.id] && <div className="note">{msg[c.id]}</div>}
          {!msg[c.id] && c.message && <div className="note">{c.message}</div>}
        </div>
      ))}
      {tts && <div className="card">
        <h3>Assistant voice</h3>
        <p>“Device” uses your phone’s own text-to-speech. Cloud voices send each reply’s text to Gemini or ElevenLabs (only in Cloud Mode; if a cloud voice fails you are told and the device voice is used).</p>
        <div><label className="l" htmlFor="ttsp">Voice engine</label>
          <select id="ttsp" className="field" value={tts.provider} onChange={(e: ChangeEvent<HTMLSelectElement>) => void saveTts({ provider: e.target.value })}>
            <option value="device">Device voice (offline-capable)</option><option value="gemini">Gemini voice (needs Gemini key)</option><option value="elevenlabs">ElevenLabs (needs key + voice IDs)</option></select></div>
        <div className="row"><div style={{ flex: 1 }}><label className="l" htmlFor="gv1">Gemini voice – Kajal</label><input id="gv1" className="field" defaultValue={tts.geminiVoices.KAJAL} onBlur={(e: ChangeEvent<HTMLInputElement>) => void saveTts({ geminiVoices: { KAJAL: e.target.value, ADAM: tts.geminiVoices.ADAM } })} /></div>
          <div style={{ flex: 1 }}><label className="l" htmlFor="gv2">Gemini voice – Adam</label><input id="gv2" className="field" defaultValue={tts.geminiVoices.ADAM} onBlur={(e: ChangeEvent<HTMLInputElement>) => void saveTts({ geminiVoices: { KAJAL: tts.geminiVoices.KAJAL, ADAM: e.target.value } })} /></div></div>
        <div className="row"><div style={{ flex: 1 }}><label className="l" htmlFor="ev1">ElevenLabs voice ID – Kajal</label><input id="ev1" className="field" defaultValue={tts.elevenVoices.KAJAL} onBlur={(e: ChangeEvent<HTMLInputElement>) => void saveTts({ elevenVoices: { KAJAL: e.target.value, ADAM: tts.elevenVoices.ADAM } })} /></div>
          <div style={{ flex: 1 }}><label className="l" htmlFor="ev2">ElevenLabs voice ID – Adam</label><input id="ev2" className="field" defaultValue={tts.elevenVoices.ADAM} onBlur={(e: ChangeEvent<HTMLInputElement>) => void saveTts({ elevenVoices: { KAJAL: tts.elevenVoices.KAJAL, ADAM: e.target.value } })} /></div></div>
      </div>}
    </Frame>
  );
}

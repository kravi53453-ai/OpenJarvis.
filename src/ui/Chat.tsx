import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { fileToDataUrl } from '../lib/image';
import { isNative, nativeExec } from '../lib/native';
import type { Msg, PersonaId, Status } from '../lib/types';
import { PROFILE_NAME } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  msgs: Msg[]; busy: boolean; persona: PersonaId; status: Status | null; statusError: string; pendingImage: string; setPendingImage: (s: string) => void;
  onSend: (text: string, image?: string) => void; onStop: () => void; onMenu: () => void; onVoice: () => void; onToast: (t: string) => void;
}

const STATUS_TEXT: Record<string, string> = { connected: 'Connected', invalid_key: 'Invalid key', not_configured: 'No API key', error: 'Connection error', untested: 'Key saved, not tested' };

export function statusDot(s: Status | null): string { return !s ? 'warn' : s.status === 'connected' ? 'ok' : s.status === 'untested' ? 'warn' : 'err'; }

export default function Chat(p: Props) {
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [p.msgs.length, p.busy]);
  useEffect(() => { const t = ta.current; if (t) { t.style.height = 'auto'; t.style.height = `${Math.min(120, t.scrollHeight)}px`; } }, [text]);

  const calls = new Map<string, { name: string; args: Record<string, unknown> }>();
  p.msgs.forEach(m => m.toolCalls?.forEach(c => calls.set(c.id, { name: c.name, args: c.args })));

  const submit = () => {
    if (p.busy) return; // never clear the input while a reply is in progress (audit #12)
    const t = text.trim(); if (!t && !p.pendingImage) return;
    p.onSend(t, p.pendingImage || undefined); setText(''); p.setPendingImage('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try { p.setPendingImage(await fileToDataUrl(f)); } catch (err) { p.onToast(err instanceof Error ? err.message : 'Image failed'); }
  };
  const openCamera = async (e?: unknown) => {
    void e; setMenu(false);
    if (!isNative()) { cam.current?.click(); return; }
    const r = await nativeExec('open_camera', { mode: 'photo', lens: 'rear' }, 300000);
    if (!r.ok) p.onToast(r.error || 'Camera failed');
  };
  const st = p.status;
  const pill = p.statusError ? 'Server unreachable' : !st ? 'Checking…' : `${st.mode === 'cloud' ? 'Cloud' : 'Offline'} · ${st.mode === 'cloud' ? st.label || st.provider : 'local model'} · ${STATUS_TEXT[st.status] || st.status}`;

  return (
    <div className="app">
      <header className="hdr">
        <button className="iconbtn" onClick={p.onMenu} aria-label="Menu"><Icon name="menu" /></button>
        <h1>OpenJarvis<button className="pill" onClick={p.onMenu}><span className={`dot ${p.statusError ? 'err' : statusDot(st)}`} />{pill}</button></h1>
        <img src={p.persona === 'ADAM' ? '/assets/ui_adam.webp' : '/assets/ui_kajal.webp'} alt={p.persona === 'ADAM' ? 'Adam' : 'Kajal'} width={38} height={38} style={{ borderRadius: 12, objectFit: 'cover', objectPosition: 'top' }} />
      </header>
      <main className="scroll">
        {!p.msgs.length && (
          <div className="empty">
            <img src={p.persona === 'ADAM' ? '/assets/ui_adam.webp' : '/assets/ui_kajal.webp'} alt="" />
            <h2>Hi {PROFILE_NAME}</h2>
            <div>I’m {p.persona === 'ADAM' ? 'Adam' : 'Kajal'}. Type a message or tap the mic.</div>
            {p.statusError && <div className="warnbox" style={{ marginTop: 14 }}>{p.statusError}</div>}
            {st && st.status !== 'connected' && !p.statusError && <div className="warnbox" style={{ marginTop: 14 }}>{st.mode === 'cloud' && st.status === 'not_configured' ? 'Add your API key in Menu → Providers to start chatting.' : st.message || 'Provider not ready. Check Menu → Providers.'}</div>}
          </div>
        )}
        {p.msgs.map(m => {
          if (m.role === 'tool') return <div className="steps" key={m.id}>{(m.toolResults || []).map(r => { const c = calls.get(r.id); return <div key={r.id} className={`step ${r.ok ? 'ok' : 'bad'}`}><b>{r.name}</b>{c && Object.keys(c.args).length ? ` ${JSON.stringify(c.args).slice(0, 80)}` : ''} — {r.result.slice(0, 140)}</div>; })}</div>;
          if (m.role === 'assistant' && !m.text && !m.image) return null;
          return <div key={m.id} className={`bub ${m.role === 'user' ? 'user' : 'ai'}${m.error ? ' err' : ''}`}>{m.image && <img src={m.image} alt="attachment" />}{m.text}</div>;
        })}
        {p.busy && <div className="typing">Thinking…</div>}
        <div ref={end} />
      </main>
      <footer className="composer" style={{ position: 'relative' }}>
        {menu && <div className="menu"><button onClick={() => { setMenu(false); file.current?.click(); }}><Icon name="image" />Photo from gallery</button><button onClick={openCamera}><Icon name="camera" />Camera</button></div>}
        {p.pendingImage && <div className="attach"><img src={p.pendingImage} alt="to send" /><button className="iconbtn" onClick={() => p.setPendingImage('')} aria-label="Remove image"><Icon name="x" /></button></div>}
        <div className="crow">
          <button className="iconbtn" onClick={() => setMenu(!menu)} aria-label="Attach"><Icon name="plus" /></button>
          <textarea ref={ta} rows={1} value={text} placeholder={`Message ${p.persona === 'ADAM' ? 'Adam' : 'Kajal'}…`} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} onKeyDown={onKey} />
          <button className="iconbtn" onClick={p.onVoice} aria-label="Voice mode"><Icon name="mic" /></button>
          {p.busy ? <button className="iconbtn sendbtn" onClick={p.onStop} aria-label="Stop"><Icon name="stop" /></button>
            : <button className="iconbtn sendbtn" onClick={submit} disabled={!text.trim() && !p.pendingImage} aria-label="Send"><Icon name="send" /></button>}
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      </footer>
    </div>
  );
}

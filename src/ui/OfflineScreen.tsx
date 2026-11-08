import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, ApiError, req } from '../lib/api';
import type { Settings } from '../lib/types';
import Frame, { Badge } from './Frame';

interface Sys { totalMemMB: number; freeMemMB: number; diskFreeMB: number | null; arch: string; cpus: number; llamaServer: string | null }
interface Cat { id: string; name: string; file: string; sizeMB: number; notes: string; installed: boolean; compat: { level: 'ok' | 'tight' | 'too_large' | 'no_disk'; message: string } }
interface Job { file: string; totalBytes: number; doneBytes: number; state: 'running' | 'paused' | 'verifying' | 'done' | 'error'; error?: string; sha256?: string }
interface Mdl { file: string; sizeMB: number; sha256: string | null }
interface OStatus { reachable: boolean; message: string; baseUrl: string; model: string; serverModels: string[]; managedServer: { state: string; file: string; log: string[] } }

export default function OfflineScreen({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const [sys, setSys] = useState<Sys | null>(null); const [cat, setCat] = useState<Cat[]>([]); const [models, setModels] = useState<Mdl[]>([]); const [jobs, setJobs] = useState<Job[]>([]);
  const [st, setSt] = useState<OStatus | null>(null); const [set, setSet] = useState<Settings | null>(null); const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const [url, setUrl] = useState(''); const [file, setFile] = useState(''); const [sha, setSha] = useState('');
  const timer = useRef(0);
  const fail = (e: unknown) => setErr(e instanceof ApiError ? e.message : 'Failed');
  const load = useCallback(async () => {
    try {
      const [s, c, m, o, se] = await Promise.all([req<Sys>('GET', '/api/offline/system'), req<Cat[]>('GET', '/api/offline/catalog'), req<{ models: Mdl[]; jobs: Job[] }>('GET', '/api/offline/models'), req<OStatus>('GET', '/api/offline/status'), api.settings()]);
      setSys(s); setCat(c); setModels(m.models); setJobs(m.jobs); setSt(o); setSet(se); setErr('');
    } catch (e) { fail(e); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const active = jobs.some(j => j.state === 'running' || j.state === 'verifying') || st?.managedServer.state === 'starting';
  useEffect(() => { if (!active) return; timer.current = window.setInterval(() => { void load(); }, 1500); return () => clearInterval(timer.current); }, [active, load]);
  const act = async (f: () => Promise<unknown>) => { setErr(''); try { await f(); } catch (e) { fail(e); } await load(); onChanged(); };
  const saveOff = (patch: unknown) => act(() => api.saveSettings({ offline: patch }));
  const pct = (j: Job) => j.totalBytes ? Math.min(100, Math.round(j.doneBytes / j.totalBytes * 100)) : 0;
  const mb = (n: number) => `${(n / 1048576).toFixed(0)} MB`;

  return (
    <Frame title="Offline mode & models" onBack={onBack}>
      <div className="card">
        <div className="row sp"><h3>Mode</h3><Badge kind={set?.mode === 'offline' ? 'ok' : undefined}>{set?.mode === 'offline' ? 'Offline active' : 'Cloud active'}</Badge></div>
        <p>Offline Mode sends your messages only to a model server running on this device. It never uses a cloud key and never falls back to the cloud if the local server stops — you will see an error instead.</p>
        <div className="row"><button className="btn primary sm" onClick={() => act(() => api.saveSettings({ mode: 'offline' }))} disabled={set?.mode === 'offline'}>Use Offline Mode</button><button className="btn sm" onClick={() => act(() => api.saveSettings({ mode: 'cloud' }))} disabled={set?.mode === 'cloud'}>Use Cloud Mode</button></div>
      </div>
      {err && <div className="warnbox">{err}</div>}{info && <div className="note">{info}</div>}
      {sys && <div className="card"><h3>This device</h3>
        <div className="note">RAM: {sys.totalMemMB} MB total, {sys.freeMemMB} MB free · Free storage: {sys.diskFreeMB ?? 'unknown'} MB · {sys.arch}, {sys.cpus} cores</div>
        <div className="note">Inference engine: {sys.llamaServer ? <>llama-server found ✓</> : <>not installed. In Termux run: <b>pkg install llama-cpp</b></>}</div>
        <div className="note">Small models run slowly on phones. Expect a few tokens per second at best on a 2 GB device, and weak tool use.</div></div>}
      {st && <div className="card"><div className="row sp"><h3>Local server</h3><Badge kind={st.reachable ? 'ok' : 'err'}>{st.reachable ? 'Reachable' : 'Not running'}</Badge></div>
        <div className="note">{st.baseUrl} · {st.message}{st.managedServer.state !== 'stopped' ? ` · managed server: ${st.managedServer.state} (${st.managedServer.file})` : ''}</div>
        {st.managedServer.state === 'error' && <div className="warnbox">{st.managedServer.log.slice(-3).join(' | ')}</div>}
        <div><label className="l" htmlFor="ob">Server address (OpenAI-compatible, e.g. llama.cpp or Ollama)</label><input id="ob" className="field" defaultValue={set?.offline.baseUrl} onBlur={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.value !== set?.offline.baseUrl) void saveOff({ baseUrl: e.target.value }); }} /></div>
        <div><label className="l" htmlFor="om">Model name {st.serverModels.length ? `(server reports: ${st.serverModels.slice(0, 3).join(', ')})` : ''}</label><input id="om" className="field" defaultValue={set?.offline.model} onBlur={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.value !== set?.offline.model) void saveOff({ model: e.target.value }); }} /></div>
        <div className="row"><label className="note"><input type="checkbox" checked={!!set?.offline.tools} onChange={(e: ChangeEvent<HTMLInputElement>) => void saveOff({ tools: e.target.checked })} /> Model supports tools</label><label className="note"><input type="checkbox" checked={!!set?.offline.vision} onChange={(e: ChangeEvent<HTMLInputElement>) => void saveOff({ vision: e.target.checked })} /> Model accepts images</label></div>
        {st.managedServer.state !== 'stopped' && <button className="btn sm danger" onClick={() => act(() => req('POST', '/api/offline/server/stop'))}>Stop local server</button>}
      </div>}
      <div className="card"><h3>Model catalog</h3><p>Sizes are approximate. Download links go to Hugging Face and could not be verified when this app was built — failures are reported, never hidden.</p>
        {cat.map(c => { const j = jobs.find(x => x.file === c.file); const lvl = c.compat.level; return (
          <div key={c.id} className="card" style={{ background: 'var(--bg)' }}>
            <div className="row sp"><b>{c.name}</b><Badge kind={lvl === 'ok' ? 'ok' : lvl === 'tight' ? 'warn' : 'err'}>{lvl === 'ok' ? 'Fits' : lvl === 'tight' ? 'Tight' : lvl === 'no_disk' ? 'No storage' : 'Too large'}</Badge></div>
            <div className="note">~{c.sizeMB} MB download · {c.compat.message}</div><div className="note">{c.notes}</div>
            {j && j.state !== 'done' && <><div className="bar"><i style={{ width: `${pct(j)}%` }} /></div><div className="note">{j.state === 'error' ? `Error: ${j.error}` : `${j.state} ${mb(j.doneBytes)}${j.totalBytes ? ` / ${mb(j.totalBytes)}` : ''}`}</div></>}
            {j?.sha256 && j.state === 'done' && <div className="note">Integrity: SHA-256 {j.sha256.slice(0, 16)}… (computed after download)</div>}
            <div className="row">
              {!c.installed && (!j || j.state === 'error') && <button className="btn primary sm" disabled={lvl === 'no_disk'} onClick={() => act(() => req('POST', '/api/offline/download', { catalogId: c.id }))}>Download</button>}
              {j?.state === 'running' && <button className="btn sm" onClick={() => act(() => req('POST', `/api/offline/download/${c.file}/pause`))}>Pause</button>}
              {j?.state === 'paused' && <button className="btn sm" onClick={() => act(() => req('POST', `/api/offline/download/${c.file}/resume`))}>Resume</button>}
              {j && (j.state === 'running' || j.state === 'paused' || j.state === 'error') && <button className="btn sm danger" onClick={() => act(() => req('POST', `/api/offline/download/${c.file}/cancel`))}>Cancel</button>}
              {c.installed && <Badge kind="ok">Installed</Badge>}
            </div></div>); })}
      </div>
      <div className="card"><h3>Installed models</h3>
        {!models.length && <div className="note">No model files yet.</div>}
        {models.map(m => <div key={m.file} className="row sp"><div><b style={{ overflowWrap: 'anywhere' }}>{m.file}</b><div className="note">{m.sizeMB} MB{m.sha256 ? ` · sha256 ${m.sha256.slice(0, 12)}…` : ''}</div></div>
          <div className="row"><button className="btn sm primary" disabled={!sys?.llamaServer || st?.managedServer.state === 'starting'} onClick={() => act(async () => { await req('POST', '/api/offline/server/start', { file: m.file }); setInfo('Starting… loading a model can take a minute.'); })}>Start</button>
            <button className="btn sm danger" onClick={() => { if (confirm(`Delete ${m.file}?`)) void act(() => req('DELETE', `/api/offline/models/${m.file}`)); }}>Delete</button></div></div>)}
        <button className="btn sm" onClick={() => act(async () => { const r = await req<{ removed: number }>('POST', '/api/offline/clear-partials'); setInfo(`Removed ${r.removed} partial download(s).`); })}>Clear partial downloads</button>
      </div>
      <div className="card"><h3>Download your own GGUF</h3>
        <input className="field" placeholder="https://…/model.gguf" value={url} onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)} />
        <input className="field" placeholder="file name, e.g. my-model.gguf" value={file} onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.value)} />
        <input className="field" placeholder="SHA-256 (optional, verifies integrity)" value={sha} onChange={(e: ChangeEvent<HTMLInputElement>) => setSha(e.target.value)} />
        <button className="btn sm primary" disabled={!url || !file} onClick={() => act(async () => { await req('POST', '/api/offline/download', { url, file, sha256: sha || undefined }); setUrl(''); setFile(''); setSha(''); })}>Download</button>
      </div>
    </Frame>
  );
}

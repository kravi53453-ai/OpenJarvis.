import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DATA_DIR, getSettings, modelsDir, saveSettings } from './store.js';
import { pingLocal } from './providers.js';

export interface CatalogEntry { id: string; name: string; file: string; url: string; sizeMB: number; notes: string }

// Sizes are approximate. URLs point at public Hugging Face GGUF files and were NOT verified from the build sandbox (no network):
// the download job checks the real size/hash and reports failures instead of assuming success.
export const CATALOG: CatalogEntry[] = [
  { id: 'qwen2.5-0.5b', name: 'Qwen2.5 0.5B Instruct (Q4_K_M)', file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf', sizeMB: 400, notes: 'Smallest. Best fit for 2 GB phones. Basic chat quality, weak at tools.' },
  { id: 'llama3.2-1b', name: 'Llama 3.2 1B Instruct (Q4_K_M)', file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf', url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf', sizeMB: 810, notes: 'Better quality; tight on 2 GB RAM, close other apps first.' },
  { id: 'qwen2.5-1.5b', name: 'Qwen2.5 1.5B Instruct (Q4_K_M)', file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf', sizeMB: 1120, notes: 'Good Hindi/English quality but too large for most 2 GB phones.' },
];

const MB = 1024 * 1024;

export function systemInfo() {
  let diskFreeMB: number | null = null;
  try { const s = fs.statfsSync(DATA_DIR.length && fs.existsSync(DATA_DIR) ? DATA_DIR : process.cwd()); diskFreeMB = Math.floor(Number(s.bavail) * Number(s.bsize) / MB); } catch { /* statfs unavailable */ }
  return { platform: process.platform, arch: process.arch, node: process.version, cpus: os.cpus().length, totalMemMB: Math.floor(os.totalmem() / MB), freeMemMB: Math.floor(os.freemem() / MB), diskFreeMB, llamaServer: findBinary('llama-server') };
}

export function compat(sizeMB: number): { level: 'ok' | 'tight' | 'too_large' | 'no_disk'; message: string } {
  const sys = systemInfo();
  const need = Math.ceil(sizeMB * 1.25 + 300); // weights + KV cache/runtime overhead (estimate)
  if (sys.diskFreeMB !== null && sys.diskFreeMB < sizeMB * 1.1) return { level: 'no_disk', message: `Needs ~${Math.ceil(sizeMB * 1.1)} MB free storage; only ${sys.diskFreeMB} MB free.` };
  if (sys.freeMemMB >= need) return { level: 'ok', message: `Needs ~${need} MB RAM; ${sys.freeMemMB} MB free now.` };
  if (sys.totalMemMB >= need * 1.3) return { level: 'tight', message: `Needs ~${need} MB RAM but only ${sys.freeMemMB} MB free now. Close other apps first.` };
  return { level: 'too_large', message: `Needs ~${need} MB RAM; device has ${sys.totalMemMB} MB total. Likely to crash.` };
}

export function listModels() {
  const dir = modelsDir();
  return fs.readdirSync(dir).filter(f => f.endsWith('.gguf')).map(f => {
    const st = fs.statSync(path.join(dir, f));
    let sha: string | null = null;
    try { sha = fs.readFileSync(path.join(dir, `${f}.sha256`), 'utf8').trim(); } catch { /* none */ }
    return { file: f, sizeMB: Math.round(st.size / MB), sha256: sha };
  });
}

export function deleteModel(file: string): void {
  if (!/^[\w.-]+\.gguf$/.test(file)) throw new Error('Invalid file name');
  if (server && serverFile === file) stopServer();
  for (const f of [file, `${file}.sha256`, `${file}.part`]) fs.rmSync(path.join(modelsDir(), f), { force: true });
}

// ---------- downloads (pause / resume / integrity) ----------
export interface Job { id: string; file: string; url: string; totalBytes: number; doneBytes: number; state: 'running' | 'paused' | 'verifying' | 'done' | 'error'; error?: string; sha256?: string; expectedSha?: string; ctl?: AbortController }
const jobs = new Map<string, Job>();

function isPrivateHost(h: string): boolean {
  return /^(localhost|.*\.local)$/i.test(h) || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i.test(h);
}

export function validateDownload(url: string, file: string): void {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error('Invalid URL'); }
  const testHook = process.env.OPENJARVIS_TEST_ALLOW_LOCAL_DL === '1'; // automated tests only; never set in production
  if (u.protocol !== 'https:' && !testHook) throw new Error('Only https:// download links are allowed.');
  if (isPrivateHost(u.hostname) && !testHook) throw new Error('Downloads from local/private addresses are not allowed.');
  if (!/^[\w.-]{3,120}\.gguf$/.test(file) || file.includes('..')) throw new Error('File name must end in .gguf and use letters, digits, dot, dash or underscore.');
}

export function jobList(): Omit<Job, 'ctl'>[] { return [...jobs.values()].map(({ ctl: _c, ...j }) => j); }

export function startDownload(url: string, file: string, expectedSha?: string, estimatedMB?: number): Omit<Job, 'ctl'> {
  validateDownload(url, file);
  if (expectedSha && !/^[a-f0-9]{64}$/i.test(expectedSha)) throw new Error('SHA-256 must be 64 hex characters.');
  const existing = jobs.get(file);
  if (existing && (existing.state === 'running' || existing.state === 'verifying')) return strip(existing);
  const need = (estimatedMB || 0) * MB;
  const sys = systemInfo();
  if (sys.diskFreeMB !== null && estimatedMB && sys.diskFreeMB * MB < need * 1.1) throw new Error(`Not enough free storage (${sys.diskFreeMB} MB free).`);
  const job: Job = existing || { id: file, file, url, totalBytes: 0, doneBytes: 0, state: 'running' };
  Object.assign(job, { url, state: 'running', error: undefined, expectedSha: expectedSha?.toLowerCase(), ctl: new AbortController() });
  jobs.set(file, job);
  void runDownload(job);
  return strip(job);
}
const strip = (j: Job): Omit<Job, 'ctl'> => { const { ctl: _c, ...r } = j; return r; };

async function runDownload(job: Job): Promise<void> {
  const dir = modelsDir();
  const part = path.join(dir, `${job.file}.part`);
  try {
    const have = fs.existsSync(part) ? fs.statSync(part).size : 0;
    const res = await fetch(job.url, { headers: have ? { Range: `bytes=${have}-` } : {}, redirect: 'follow', signal: job.ctl!.signal });
    if (!res.ok || !res.body) throw new Error(`Server answered HTTP ${res.status}`);
    const resumed = res.status === 206 && have > 0;
    const start = resumed ? have : 0;
    const len = Number(res.headers.get('content-length') || 0);
    job.totalBytes = len ? start + len : 0;
    job.doneBytes = start;
    const out = fs.createWriteStream(part, { flags: resumed ? 'a' : 'w' });
    const src = Readable.fromWeb(res.body as never);
    src.on('data', (c: Buffer) => { job.doneBytes += c.length; });
    await pipeline(src, out);
    job.state = 'verifying';
    const final = path.join(dir, job.file);
    const hash = crypto.createHash('sha256');
    await pipeline(fs.createReadStream(part), hash);
    job.sha256 = hash.digest('hex');
    if (job.totalBytes && fs.statSync(part).size !== job.totalBytes) throw new Error('Downloaded size does not match the server-reported size.');
    if (job.expectedSha && job.expectedSha !== job.sha256) { fs.rmSync(part, { force: true }); throw new Error('Integrity check FAILED: SHA-256 does not match. File deleted.'); }
    fs.renameSync(part, final);
    fs.writeFileSync(`${final}.sha256`, job.sha256);
    job.state = 'done';
  } catch (e) {
    if (job.ctl?.signal.aborted && job.state !== 'error') { if (job.state === 'running') job.state = 'paused'; return; }
    job.state = 'error';
    job.error = e instanceof Error ? e.message : 'Download failed';
  }
}

export function pauseDownload(file: string): void { const j = jobs.get(file); if (j && j.state === 'running') { j.state = 'paused'; j.ctl?.abort(); } }
export function cancelDownload(file: string): void {
  const j = jobs.get(file);
  if (j) { j.state = 'error'; j.error = 'Cancelled'; j.ctl?.abort(); jobs.delete(file); }
  if (/^[\w.-]+\.gguf$/.test(file)) fs.rmSync(path.join(modelsDir(), `${file}.part`), { force: true });
}
export function clearPartials(): number {
  let n = 0;
  for (const f of fs.readdirSync(modelsDir())) if (f.endsWith('.part') && ![...jobs.values()].some(j => j.file + '.part' === f && j.state === 'running')) { fs.rmSync(path.join(modelsDir(), f), { force: true }); n++; }
  return n;
}

// ---------- local inference server (llama.cpp) ----------
let server: ChildProcess | null = null;
let serverFile = '';
let serverState: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';
const logTail: string[] = [];

export function findBinary(name: string): string | null {
  for (const d of (process.env.PATH || '').split(path.delimiter)) { const p = path.join(d, name); try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* next */ } }
  return null;
}

export function startServer(file: string, ctx = 1024, port = 8080): void {
  if (!/^[\w.-]+\.gguf$/.test(file) || !fs.existsSync(path.join(modelsDir(), file))) throw new Error('Model file not found. Download it first.');
  const bin = findBinary('llama-server');
  if (!bin) throw new Error('llama-server not found. In Termux run: pkg install llama-cpp');
  const c = Math.min(4096, Math.max(512, Math.floor(ctx)));
  if (server) stopServer();
  logTail.length = 0; serverState = 'starting'; serverFile = file;
  server = spawn(bin, ['-m', path.join(modelsDir(), file), '--host', '127.0.0.1', '--port', String(port), '-c', String(c), '-t', String(Math.max(1, Math.min(4, os.cpus().length)))], { stdio: ['ignore', 'pipe', 'pipe'] });
  const push = (b: Buffer) => { for (const l of b.toString().split('\n')) if (l.trim()) { logTail.push(l.slice(0, 200)); if (logTail.length > 40) logTail.shift(); } };
  server.stdout?.on('data', push); server.stderr?.on('data', push);
  server.on('exit', code => { if (serverState !== 'stopped') { serverState = code === 0 ? 'stopped' : 'error'; } server = null; });
  server.on('error', e => { serverState = 'error'; logTail.push(`spawn error: ${e.message}`); server = null; });
  saveSettings({ offline: { baseUrl: `http://127.0.0.1:${port}/v1`, model: file, contextSize: c } });
}
export function stopServer(): void { serverState = 'stopped'; try { server?.kill('SIGTERM'); } catch { /* already dead */ } server = null; }
process.on('exit', () => { try { server?.kill('SIGTERM'); } catch { /* ignore */ } });

export async function offlineStatus() {
  const s = getSettings().offline;
  const ping = await pingLocal(s.baseUrl);
  if (serverState === 'starting' && ping.ok) serverState = 'running';
  return { baseUrl: s.baseUrl, model: s.model, reachable: ping.ok, message: ping.message, serverModels: ping.models, managedServer: { state: serverState, file: serverFile, log: logTail.slice(-8) }, settings: s };
}

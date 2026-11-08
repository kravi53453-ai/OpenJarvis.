import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as offline from './offline.js';
import { chat, PROVIDERS, pingLocal, testConnection, ttsEleven, ttsGemini } from './providers.js';
import { DATA_DIR, deleteKey, getKey, getSettings, loadEnvFile, maskKey, saveSettings, setKey } from './store.js';
import { buildSystemPrompt, toolsFor } from './tools.js';
import { ProviderError } from './types.js';
import type { ChatProviderId, PersonaId, ProviderId, ToolCall, ToolResult, WireMsg } from './types.js';

loadEnvFile();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const LAN = !['127.0.0.1', 'localhost', '::1'].includes(HOST);
const MAX_BODY = Number(process.env.OPENJARVIS_MAX_BODY || 6 * 1024 * 1024);
const WEB_DIR = path.resolve(process.env.OPENJARVIS_WEB || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
let TOKEN = process.env.OPENJARVIS_TOKEN || '';
if (LAN && !TOKEN) { TOKEN = crypto.randomBytes(16).toString('hex'); }

class HttpError extends Error { constructor(public status: number, message: string, public code = 'bad_request') { super(message); } }

const isLoopback = (a?: string) => !!a && (a === '::1' || a.startsWith('127.') || a === '::ffff:127.0.0.1');

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Invalid JSON')); } });
    req.on('error', () => reject(new HttpError(400, 'Read error')));
  });
}

// ---- tiny in-memory rate limiter ----
const hits = new Map<string, number[]>();
function rateLimit(ip: string, bucket: string, max: number): void {
  const k = `${ip}|${bucket}`; const now = Date.now();
  const arr = (hits.get(k) || []).filter(t => now - t < 60000);
  if (arr.length >= max) throw new HttpError(429, 'Too many requests, slow down.', 'rate_limited');
  arr.push(now); hits.set(k, arr);
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 60000)) hits.delete(k); }, 60000).unref();

// ---- validation helpers ----
const str = (v: unknown, max: number, name: string, required = true): string => {
  if (v === undefined || v === null || v === '') { if (required) throw new HttpError(400, `${name} is required`); return ''; }
  if (typeof v !== 'string') throw new HttpError(400, `${name} must be text`);
  if (v.length > max) throw new HttpError(400, `${name} too long`);
  return v;
};
const isProvider = (v: unknown): v is ProviderId => typeof v === 'string' && v in PROVIDERS;
const isChatProvider = (v: unknown): v is ChatProviderId => isProvider(v) && v !== 'elevenlabs';

function parseMessages(v: unknown): WireMsg[] {
  if (!Array.isArray(v) || !v.length) throw new HttpError(400, 'messages required');
  if (v.length > 60) throw new HttpError(400, 'too many messages');
  let chars = 0;
  return v.map((m): WireMsg => {
    if (!m || typeof m !== 'object') throw new HttpError(400, 'bad message');
    const r = m as Record<string, unknown>;
    if (r.role !== 'user' && r.role !== 'assistant' && r.role !== 'tool') throw new HttpError(400, 'bad role');
    const out: WireMsg = { role: r.role };
    if (r.text !== undefined) { out.text = str(r.text, 20000, 'text', false); chars += out.text.length; }
    if (r.image !== undefined && r.image !== null) { out.image = str(r.image, 2_500_000, 'image'); }
    if (Array.isArray(r.toolCalls)) out.toolCalls = r.toolCalls.slice(0, 8).map((t: ToolCall) => ({ id: str(t.id, 120, 'tool id'), name: str(t.name, 60, 'tool name'), args: t.args && typeof t.args === 'object' ? t.args : {}, raw: t.raw }));
    if (Array.isArray(r.toolResults)) out.toolResults = r.toolResults.slice(0, 8).map((t: ToolResult) => ({ id: str(t.id, 120, 'tool id'), name: str(t.name, 60, 'tool name'), result: str(t.result, 12000, 'tool result', false) }));
    if (chars > 120000) throw new HttpError(400, 'conversation too long');
    return out;
  });
}

function providerCard(id: ProviderId) {
  const s = getSettings(); const k = getKey(id); const last = s.lastTest[id];
  return {
    id, label: PROVIDERS[id].label, keyHelp: PROVIDERS[id].keyHelp, isChat: id !== 'elevenlabs',
    model: s.models[id] || PROVIDERS[id].defaultModel, defaultModel: PROVIDERS[id].defaultModel,
    configured: !!k, source: k?.source ?? null, masked: k ? maskKey(k.key) : '',
    status: !k ? 'not_configured' : last?.status ?? 'untested', message: last?.message ?? '', testedAt: last?.at ?? null,
  };
}

async function api(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const ip = req.socket.remoteAddress || '?';
  const route = `${req.method} ${url.pathname}`;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Cross-origin request blocked', 'forbidden');
  }

  if (route === 'GET /api/health') return send(res, 200, { ok: true, app: 'OpenJarvis', lan: LAN, tokenRequired: !isLoopback(ip) });

  if (route === 'GET /api/status') {
    const s = getSettings();
    if (s.mode === 'offline') { const o = await offline.offlineStatus(); return send(res, 200, { mode: 'offline', provider: 'local', model: s.offline.model || o.serverModels[0] || '', status: o.reachable ? 'connected' : 'error', message: o.message, user: 'Ravi' }); }
    const c = providerCard(s.provider);
    return send(res, 200, { mode: 'cloud', provider: s.provider, label: c.label, model: c.model, status: c.status, message: c.message, user: 'Ravi' });
  }

  if (route === 'GET /api/settings') return send(res, 200, getSettings());
  if (route === 'PUT /api/settings') {
    const b = await readBody(req) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (b.mode !== undefined) { if (b.mode !== 'cloud' && b.mode !== 'offline') throw new HttpError(400, 'mode must be cloud or offline'); patch.mode = b.mode; }
    if (b.provider !== undefined) { if (!isChatProvider(b.provider)) throw new HttpError(400, 'unknown provider'); patch.provider = b.provider; }
    if (b.tts && typeof b.tts === 'object') {
      const t = b.tts as Record<string, unknown>; const tp: Record<string, unknown> = {};
      if (t.provider !== undefined) { if (!['device', 'gemini', 'elevenlabs'].includes(t.provider as string)) throw new HttpError(400, 'bad tts provider'); tp.provider = t.provider; }
      for (const k of ['geminiModel', 'elevenModel']) if (t[k] !== undefined) tp[k] = str(t[k], 80, k);
      for (const k of ['geminiVoices', 'elevenVoices']) if (t[k] && typeof t[k] === 'object') { const o = t[k] as Record<string, unknown>; tp[k] = { KAJAL: str(o.KAJAL, 60, k, false), ADAM: str(o.ADAM, 60, k, false) }; }
      patch.tts = tp;
    }
    if (b.offline && typeof b.offline === 'object') {
      const o = b.offline as Record<string, unknown>; const op: Record<string, unknown> = {};
      if (o.baseUrl !== undefined) { const u = str(o.baseUrl, 200, 'baseUrl'); try { const p = new URL(u); if (!/^https?:$/.test(p.protocol)) throw new Error(); } catch { throw new HttpError(400, 'baseUrl must be http(s)://host:port/v1'); } op.baseUrl = u; }
      if (o.model !== undefined) op.model = str(o.model, 160, 'model', false);
      if (o.tools !== undefined) op.tools = o.tools === true;
      if (o.vision !== undefined) op.vision = o.vision === true;
      if (o.contextSize !== undefined) op.contextSize = Math.min(4096, Math.max(512, Number(o.contextSize) || 1024));
      patch.offline = op;
    }
    return send(res, 200, saveSettings(patch));
  }

  if (route === 'GET /api/providers') return send(res, 200, (Object.keys(PROVIDERS) as ProviderId[]).map(providerCard));
  const pm = /^(PUT|DELETE|POST) \/api\/providers\/([a-z]+)(?:\/(test))?$/.exec(route);
  if (pm) {
    const id = pm[2];
    if (!isProvider(id)) throw new HttpError(404, 'Unknown provider', 'not_found');
    if (pm[1] === 'POST' && pm[3] === 'test') {
      rateLimit(ip, 'test', 20);
      const k = getKey(id);
      const r = await testConnection(id, k?.key || '');
      saveSettings({ lastTest: { [id]: { status: r.status, at: Date.now(), message: r.message } } });
      return send(res, 200, providerCard(id));
    }
    if (pm[1] === 'PUT' && !pm[3]) {
      const b = await readBody(req) as Record<string, unknown>;
      if (b.key !== undefined && b.key !== '') {
        const key = str(b.key, 400, 'key').trim();
        if (/\s/.test(key) || key.length < 8) throw new HttpError(400, 'That does not look like an API key.');
        setKey(id, key);
        saveSettings({ lastTest: { [id]: { status: 'untested', at: Date.now(), message: 'Key saved. Press Test connection.' } } });
      }
      if (b.model !== undefined) saveSettings({ models: { [id]: str(b.model, 160, 'model', false) || PROVIDERS[id].defaultModel } });
      return send(res, 200, providerCard(id));
    }
    if (pm[1] === 'DELETE' && !pm[3]) { deleteKey(id); return send(res, 200, providerCard(id)); }
  }

  if (route === 'POST /api/chat') {
    rateLimit(ip, 'chat', Number(process.env.OPENJARVIS_RATE_CHAT) || 40);
    const b = await readBody(req) as Record<string, unknown>;
    const messages = parseMessages(b.messages);
    const persona: PersonaId = b.persona === 'ADAM' ? 'ADAM' : 'KAJAL';
    const native = b.nativeTools === true;
    const system = buildSystemPrompt(persona, native, str(b.memoryContext, 6000, 'memoryContext', false));
    const s = getSettings();
    if (s.mode === 'offline') {
      const model = s.offline.model || (await pingLocal(s.offline.baseUrl)).models[0] || '';
      if (!model) throw new HttpError(503, 'Offline Mode is on but no local model server is running. Open Menu → Offline Mode.', 'offline_unavailable');
      const reply = await chat({ provider: 'local', baseUrl: s.offline.baseUrl, model, key: '', system, messages, tools: s.offline.tools ? toolsFor(native) : [], allowImages: s.offline.vision });
      return send(res, 200, { ok: true, ...reply, mode: 'offline', provider: 'local', model });
    }
    const k = getKey(s.provider);
    if (!k) throw new ProviderError('not_configured', `${PROVIDERS[s.provider].label} has no API key. Open Menu → Providers and add your key.`, 400);
    const model = s.models[s.provider] || PROVIDERS[s.provider].defaultModel;
    const reply = await chat({ provider: s.provider, model, key: k.key, system, messages, tools: toolsFor(native), allowImages: true });
    return send(res, 200, { ok: true, ...reply, mode: 'cloud', provider: s.provider, model });
  }

  if (route === 'POST /api/tts') {
    rateLimit(ip, 'tts', 40);
    const b = await readBody(req) as Record<string, unknown>;
    const text = str(b.text, 1500, 'text'); const persona: PersonaId = b.persona === 'ADAM' ? 'ADAM' : 'KAJAL';
    const s = getSettings();
    if (s.mode === 'offline') throw new HttpError(409, 'Cloud voice is disabled in Offline Mode; using the device voice.', 'offline_mode');
    if (s.tts.provider === 'gemini') {
      const k = getKey('gemini'); if (!k) throw new ProviderError('not_configured', 'Gemini key missing for voice.', 400);
      const r = await ttsGemini(text, s.tts.geminiVoices[persona], s.tts.geminiModel, k.key);
      return send(res, 200, { mime: r.mime, audio: r.audio.toString('base64'), voice: 'gemini' });
    }
    if (s.tts.provider === 'elevenlabs') {
      const k = getKey('elevenlabs'); if (!k) throw new ProviderError('not_configured', 'ElevenLabs key missing.', 400);
      const r = await ttsEleven(text, s.tts.elevenVoices[persona], s.tts.elevenModel, k.key);
      return send(res, 200, { mime: r.mime, audio: r.audio.toString('base64'), voice: 'elevenlabs' });
    }
    throw new HttpError(409, 'Device voice selected.', 'device_voice');
  }

  if (route === 'GET /api/offline/status') return send(res, 200, await offline.offlineStatus());
  if (route === 'GET /api/offline/system') return send(res, 200, offline.systemInfo());
  if (route === 'GET /api/offline/catalog') return send(res, 200, offline.CATALOG.map(c => ({ ...c, compat: offline.compat(c.sizeMB), installed: offline.listModels().some(m => m.file === c.file) })));
  if (route === 'GET /api/offline/models') return send(res, 200, { models: offline.listModels(), jobs: offline.jobList() });
  if (route === 'POST /api/offline/download') {
    const b = await readBody(req) as Record<string, unknown>;
    let url: string, file: string, size: number | undefined;
    if (typeof b.catalogId === 'string') { const c = offline.CATALOG.find(x => x.id === b.catalogId); if (!c) throw new HttpError(404, 'Unknown catalog entry'); url = c.url; file = c.file; size = c.sizeMB; }
    else { url = str(b.url, 500, 'url'); file = str(b.file, 120, 'file'); }
    try { return send(res, 200, offline.startDownload(url, file, typeof b.sha256 === 'string' && b.sha256 ? b.sha256 : undefined, size)); }
    catch (e) { throw new HttpError(400, e instanceof Error ? e.message : 'Download rejected'); }
  }
  const dm = /^POST \/api\/offline\/download\/([\w.-]+)\/(pause|resume|cancel)$/.exec(route);
  if (dm) {
    const file = dm[1];
    if (dm[2] === 'pause') offline.pauseDownload(file);
    else if (dm[2] === 'cancel') offline.cancelDownload(file);
    else { const j = offline.jobList().find(x => x.file === file); if (!j) throw new HttpError(404, 'No such download'); try { offline.startDownload(j.url, file, j.expectedSha); } catch (e) { throw new HttpError(400, e instanceof Error ? e.message : 'Cannot resume'); } }
    return send(res, 200, { jobs: offline.jobList() });
  }
  if (route === 'POST /api/offline/clear-partials') return send(res, 200, { removed: offline.clearPartials() });
  const del = /^DELETE \/api\/offline\/models\/([\w.-]+)$/.exec(route);
  if (del) { try { offline.deleteModel(del[1]); } catch (e) { throw new HttpError(400, e instanceof Error ? e.message : 'Delete failed'); } return send(res, 200, { models: offline.listModels() }); }
  if (route === 'POST /api/offline/server/start') {
    const b = await readBody(req) as Record<string, unknown>;
    try { offline.startServer(str(b.file, 120, 'file'), Number(b.contextSize) || getSettings().offline.contextSize); } catch (e) { throw new HttpError(400, e instanceof Error ? e.message : 'Cannot start'); }
    return send(res, 200, await offline.offlineStatus());
  }
  if (route === 'POST /api/offline/server/stop') { offline.stopServer(); return send(res, 200, await offline.offlineStatus()); }

  throw new HttpError(404, 'Not found', 'not_found');
}

// ---- static files ----
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const gz = new Map<string, Buffer>();
function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  let rel = decodeURIComponent(url.pathname);
  if (rel.includes('\0')) throw new HttpError(400, 'Bad path');
  let file = path.join(WEB_DIR, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(WEB_DIR + path.sep) && file !== WEB_DIR) throw new HttpError(403, 'Forbidden', 'forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { if (path.extname(rel)) throw new HttpError(404, 'Not found', 'not_found'); file = path.join(WEB_DIR, 'index.html'); }
  if (!fs.existsSync(file)) throw new HttpError(503, 'Web UI is not built. Run: npm run build', 'not_built');
  const ext = path.extname(file);
  const headers: Record<string, string> = {
    'content-type': MIME[ext] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  };
  let body: Buffer = fs.readFileSync(file);
  if (/\.(html|js|css|svg|json)$/.test(ext) && /gzip/.test(String(req.headers['accept-encoding']))) {
    const key = `${file}:${fs.statSync(file).mtimeMs}`;
    let z = gz.get(key); if (!z) { z = zlib.gzipSync(body); gz.set(key, z); }
    body = z; headers['content-encoding'] = 'gzip'; headers.vary = 'accept-encoding';
  }
  res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
}

export const server = http.createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url || '/', 'http://x');
      const ip = req.socket.remoteAddress || '';
      const hostHdr = String(req.headers.host || '');
      // DNS-rebinding guard when only listening on loopback
      if (!LAN && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(hostHdr)) throw new HttpError(403, 'Unexpected Host header', 'forbidden');
      if (url.pathname.startsWith('/api/')) {
        if (!isLoopback(ip)) {
          const given = String(req.headers['x-openjarvis-token'] || '');
          const a = Buffer.from(given), b = Buffer.from(TOKEN);
          if (!TOKEN || a.length !== b.length || !crypto.timingSafeEqual(a, b)) { if (url.pathname !== '/api/health') throw new HttpError(401, 'Access token required', 'unauthorized'); }
        }
        return await api(req, res, url);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
      serveStatic(req, res, url);
    } catch (e) {
      if (res.headersSent) { res.end(); return; }
      if (e instanceof HttpError) return send(res, e.status, { ok: false, code: e.code, error: e.message });
      if (e instanceof ProviderError) return send(res, e.status, { ok: false, code: e.code, error: e.message });
      console.error('Unhandled error:', e instanceof Error ? e.message : e);
      send(res, 500, { ok: false, code: 'internal', error: 'Internal error' });
    }
  })();
});

if (!process.env.OPENJARVIS_NO_LISTEN) {
  server.listen(PORT, HOST, () => {
    console.log(`OpenJarvis server → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (data: ${DATA_DIR})`);
    if (LAN) console.log(`LAN access is ON. Access token (needed by other devices): ${TOKEN}`);
    else console.log('Listening on this device only (127.0.0.1). Set HOST=0.0.0.0 to allow other devices (token required).');
  });
}

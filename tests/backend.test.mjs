// Backend integration test: starts the real server bundle + a mock upstream for every provider. No real keys, no network.
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const results = []; const ok = (n, c, d = '') => { results.push({ n, pass: !!c, d }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  → ' + d}`); };
const seen = []; // requests received by mock upstream

const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    seen.push({ url: req.url, headers: req.headers, body: b ? JSON.parse(b) : null });
    const auth = req.headers.authorization || req.headers['x-goog-api-key'] || req.headers['x-api-key'] || req.headers['xi-api-key'] || '';
    const bad = !req.url.startsWith('/local') && !String(auth).includes('GOODKEY123');
    const j = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (bad && !req.url.includes('/health')) return j(401, { error: { message: 'bad key' } });
    if (req.url.startsWith('/gemini/models?')) return j(200, { models: [] });
    if (req.url.includes(':generateContent')) {
      if (req.url.includes('tts')) return j(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(480).toString('base64') } }] } }] });
      const last = req.url.length && JSON.parse(b).contents.at(-1);
      if (last.parts[0].functionResponse) return j(200, { candidates: [{ content: { parts: [{ text: 'Done: ' + last.parts[0].functionResponse.response.result }] } }] });
      return j(200, { candidates: [{ content: { parts: [{ functionCall: { name: 'open_app', args: { app_name: 'WhatsApp' } }, thoughtSignature: 'SIG' }] } }] });
    }
    if (req.url.endsWith('/chat/completions')) { const m = JSON.parse(b).messages.at(-1); return j(200, { choices: [{ message: m.role === 'tool' ? { content: 'openai-compat saw tool: ' + m.content } : { content: null, tool_calls: [{ id: 'c1', function: { name: 'tap', arguments: '{"text":"OK"}' } }] } }] }); }
    if (req.url.endsWith('/messages')) return j(200, { content: [{ type: 'text', text: 'claude says hi' }] });
    if (req.url.includes('/text-to-speech/')) { res.writeHead(200, { 'content-type': 'audio/mpeg' }); return res.end(Buffer.from('ID3fake')); }
    if (req.url.endsWith('/models') || req.url.endsWith('/auth/key') || req.url.startsWith('/eleven/models')) return j(200, { data: [{ id: 'local-model' }] });
    j(404, {});
  });
});
await new Promise(r => mock.listen(0, '127.0.0.1', r));
const mp = mock.address().port; const MB = `http://127.0.0.1:${mp}`;

const data = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-'));
const PORT = 3900 + Math.floor(Math.random() * 90);
const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', OPENJARVIS_DATA: data, GEMINI_API_KEY: '', OPENJARVIS_WEB: path.resolve('dist'),
  OPENJARVIS_TEST_BASE_GEMINI: `${MB}/gemini`, OPENJARVIS_TEST_BASE_OPENAI: `${MB}/openai`, OPENJARVIS_TEST_BASE_OPENROUTER: `${MB}/or`, OPENJARVIS_TEST_BASE_DEEPSEEK: `${MB}/ds`,
  OPENJARVIS_TEST_BASE_NVIDIA: `${MB}/nv`, OPENJARVIS_TEST_BASE_ANTHROPIC: `${MB}/anthropic`, OPENJARVIS_TEST_BASE_ELEVENLABS: `${MB}/eleven` };
const srv = spawn('node', ['dist-server/server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
for (let i = 0; i < 50 && !out.includes('OpenJarvis server'); i++) await new Promise(r => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const call = async (m, p, body, headers = {}) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }); let j; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };

try {
  ok('server starts on loopback only', out.includes('127.0.0.1') && out.includes('this device only'), out);
  let r = await call('GET', '/api/health'); ok('health endpoint', r.s === 200 && r.j.ok);
  r = await call('GET', '/api/providers'); ok('7 providers listed, all Not Configured', r.j.length === 7 && r.j.every(p => p.status === 'not_configured'));
  r = await call('POST', '/api/chat', { messages: [{ role: 'user', text: 'hi' }] }); ok('chat without key → clear not_configured error (no silent fallback)', r.s === 400 && r.j.code === 'not_configured', JSON.stringify(r));

  // Key lifecycle + masking
  r = await call('PUT', '/api/providers/gemini', { key: 'BADKEYXXXXXX' }); ok('save key returns masked only', r.j.masked === '••••••••XXXX' && !JSON.stringify(r.j).includes('BADKEYXXXXXX'), JSON.stringify(r.j));
  r = await call('POST', '/api/providers/gemini/test'); ok('invalid key → invalid_key', r.j.status === 'invalid_key', JSON.stringify(r.j));
  const keysFile = path.join(data, 'keys.json'); const mode = (fs.statSync(keysFile).mode & 0o777).toString(8);
  ok('keys.json permissions 0600', mode === '600', mode);
  const sj = fs.readFileSync(path.join(data, 'settings.json'), 'utf8'); ok('keys never written to settings.json', !sj.includes('BADKEY'));
  ok('GET /api/settings has no keys', !JSON.stringify((await call('GET', '/api/settings')).j).includes('BADKEY'));

  // Gemini tool-call round trip (thoughtSignature echoed back)
  await call('PUT', '/api/providers/gemini', { key: 'GOODKEY123456' });
  r = await call('POST', '/api/providers/gemini/test'); ok('valid key → connected', r.j.status === 'connected', JSON.stringify(r.j));
  r = await call('POST', '/api/chat', { nativeTools: true, persona: 'ADAM', messages: [{ role: 'user', text: 'open whatsapp' }] });
  ok('gemini returns tool call', r.j.toolCalls?.[0]?.name === 'open_app' && r.j.toolCalls[0].args.app_name === 'WhatsApp', JSON.stringify(r));
  const tc = r.j.toolCalls;
  r = await call('POST', '/api/chat', { nativeTools: true, messages: [{ role: 'user', text: 'open whatsapp' }, { role: 'assistant', toolCalls: tc }, { role: 'tool', toolResults: [{ id: tc[0].id, name: 'open_app', result: 'launched' }] }] });
  ok('gemini follow-up with full history works (audit #1)', r.j.text === 'Done: launched', JSON.stringify(r));
  const follow = seen.filter(x => x.url.includes(':generateContent')).at(-1).body;
  ok('follow-up includes original prompt + model functionCall turn + thoughtSignature', follow.contents.length === 3 && follow.contents[1].role === 'model' && follow.contents[1].parts[0].thoughtSignature === 'SIG');
  ok('gemini key sent in header, not URL', !seen.at(-1).url.includes('GOOD') && seen.at(-1).headers['x-goog-api-key'] === 'GOODKEY123456');
  ok('browser mode: only memory tools exposed', (await call('POST', '/api/chat', { nativeTools: false, messages: [{ role: 'user', text: 'x' }] }), seen.at(-1).body.tools[0].functionDeclarations.map(t => t.name).join() === 'remember,recall'));

  // OpenAI-compatible providers
  for (const id of ['openai', 'openrouter', 'deepseek', 'nvidia']) {
    await call('PUT', `/api/providers/${id}`, { key: 'GOODKEY123456' });
    r = await call('POST', `/api/providers/${id}/test`); ok(`${id}: test connection → connected`, r.j.status === 'connected', JSON.stringify(r.j));
    await call('PUT', '/api/settings', { provider: id });
    r = await call('POST', '/api/chat', { nativeTools: true, messages: [{ role: 'user', text: 'tap ok' }] });
    ok(`${id}: tool call parsed`, r.j.toolCalls?.[0]?.name === 'tap' && r.j.toolCalls[0].args.text === 'OK', JSON.stringify(r));
    r = await call('POST', '/api/chat', { nativeTools: true, messages: [{ role: 'user', text: 'tap ok' }, { role: 'assistant', toolCalls: r.j.toolCalls }, { role: 'tool', toolResults: [{ id: 'c1', name: 'tap', result: 'clicked' }] }] });
    ok(`${id}: tool result round trip`, r.j.text === 'openai-compat saw tool: clicked', JSON.stringify(r));
  }
  ok('openrouter test uses authenticated /auth/key endpoint', seen.some(x => x.url === '/or/auth/key'));

  await call('PUT', '/api/providers/anthropic', { key: 'GOODKEY123456' }); await call('PUT', '/api/settings', { provider: 'anthropic' });
  r = await call('POST', '/api/providers/anthropic/test'); ok('anthropic: connected', r.j.status === 'connected');
  r = await call('POST', '/api/chat', { messages: [{ role: 'user', text: 'hi' }] }); ok('anthropic chat', r.j.text === 'claude says hi', JSON.stringify(r));
  ok('anthropic headers (x-api-key + version)', seen.at(-1).headers['anthropic-version'] === '2023-06-01' && seen.at(-1).headers['x-api-key'] === 'GOODKEY123456');

  // TTS
  await call('PUT', '/api/settings', { tts: { provider: 'gemini' } });
  const tr = await call('POST', '/api/tts', { text: 'hello', persona: 'KAJAL' });
  const wav = Buffer.from(tr.j.audio || '', 'base64');
  ok('gemini TTS PCM wrapped into valid WAV (audit #3)', tr.j.mime === 'audio/wav' && wav.subarray(0, 4).toString() === 'RIFF' && wav.subarray(8, 12).toString() === 'WAVE' && wav.length === 44 + 480, JSON.stringify(tr.j).slice(0, 100));
  await call('PUT', '/api/providers/elevenlabs', { key: 'GOODKEY123456' });
  r = await call('POST', '/api/providers/elevenlabs/test'); ok('elevenlabs: connected', r.j.status === 'connected', JSON.stringify(r.j));
  await call('PUT', '/api/settings', { tts: { provider: 'elevenlabs', elevenVoices: { KAJAL: 'abcdEFGH1234', ADAM: '' } } });
  r = await call('POST', '/api/tts', { text: 'hi', persona: 'KAJAL' }); ok('elevenlabs TTS returns mp3', r.j.mime === 'audio/mpeg' && Buffer.from(r.j.audio, 'base64').toString() === 'ID3fake', JSON.stringify(r).slice(0, 120));
  r = await call('POST', '/api/tts', { text: 'hi', persona: 'ADAM' }); ok('elevenlabs missing voice id → clear error', r.s === 400, JSON.stringify(r));

  // Offline mode
  await call('PUT', '/api/settings', { mode: 'offline', offline: { baseUrl: `${MB}/local`, model: 'local-model' } });
  r = await call('GET', '/api/status'); ok('status shows offline + reachable', r.j.mode === 'offline' && r.j.status === 'connected', JSON.stringify(r.j));
  seen.length = 0;
  r = await call('POST', '/api/chat', { messages: [{ role: 'user', text: 'tap ok' }] }); ok('offline chat uses local server only', r.j.mode === 'offline' && seen.every(x => x.url.startsWith('/local')), JSON.stringify(r));
  ok('offline: no auth header sent', !seen[0].headers.authorization);
  ok('offline: tools not sent unless enabled', !seen[0].body.tools);
  r = await call('POST', '/api/tts', { text: 'hi' }); ok('offline: cloud TTS refused', r.s === 409 && r.j.code === 'offline_mode');
  r = await call('POST', '/api/chat', { messages: [{ role: 'user', text: 'x', image: 'data:image/png;base64,AAAA' }] }); ok('offline: image refused when vision off', r.s === 400 && r.j.code === 'unsupported');
  await call('PUT', '/api/settings', { offline: { baseUrl: 'http://127.0.0.1:1/v1' } });
  const before = seen.length;
  r = await call('POST', '/api/chat', { messages: [{ role: 'user', text: 'x' }] }); ok('offline with dead server → error, NOT silent cloud fallback', r.s >= 400 && seen.length === before, JSON.stringify(r));
  r = await call('GET', '/api/status'); ok('status shows offline error', r.j.mode === 'offline' && r.j.status === 'error');
  await call('PUT', '/api/settings', { mode: 'cloud' });

  // Offline model manager
  r = await call('GET', '/api/offline/system'); ok('system info has RAM/disk', r.j.totalMemMB > 0 && 'diskFreeMB' in r.j);
  r = await call('GET', '/api/offline/catalog'); ok('catalog entries have compat verdicts', r.j.length === 3 && r.j.every(c => c.compat.level));
  r = await call('POST', '/api/offline/download', { url: 'http://x.com/a.gguf', file: 'a.gguf' }); ok('download rejects http://', r.s === 400);
  r = await call('POST', '/api/offline/download', { url: 'https://127.0.0.1/a.gguf', file: 'a.gguf' }); ok('download rejects private hosts (SSRF)', r.s === 400);
  r = await call('POST', '/api/offline/download', { url: 'https://example.com/a', file: '../x.gguf' }); ok('download rejects bad filename', r.s === 400);
  r = await call('POST', '/api/offline/server/start', { file: 'nope.gguf' }); ok('start server refuses missing model', r.s === 400);

  // Security
  r = await call('POST', '/api/chat', { messages: 'x' }); ok('validation rejects bad payload', r.s === 400);
  const big = await fetch(B + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', text: 'a'.repeat(7 * 1024 * 1024) }] }) }).then(x => x.status).catch(() => 413); ok('oversized body rejected (413)', big === 413 || big === 0, String(big));
  r = await call('POST', '/api/chat', { messages: [{ role: 'user', text: 'x' }] }, { origin: 'http://evil.example' }); ok('cross-origin POST blocked', r.s === 403);
  r = await new Promise(res => { const q = http.request({ host: '127.0.0.1', port: PORT, path: '/api/health', headers: { host: 'evil.example' } }, x => { x.resume(); res(x.statusCode); }); q.end(); }); ok('DNS-rebinding Host header blocked', r === 403, String(r));
  r = await fetch(B + '/..%2f..%2fetc/passwd').then(x => x.status); ok('path traversal blocked', r !== 200, String(r));
  r = await fetch(B + '/').then(async x => ({ s: x.status, h: x.headers.get('content-security-policy'), t: await x.text() })); ok('serves index.html with CSP', r.s === 200 && r.h?.includes("script-src 'self'") && r.t.includes('OpenJarvis'), `${r.s}`);
  r = await fetch(B + '/assets/jarvis_logo.webp').then(x => x.status); ok('static asset served', r === 200, String(r));
  const keysOnDisk = fs.readFileSync(keysFile, 'utf8'); ok('real key only in 0600 keys.json', keysOnDisk.includes('GOODKEY123456'));
  r = await call('DELETE', '/api/providers/gemini'); ok('delete key → not_configured', r.j.status === 'not_configured');
} catch (e) { ok('test harness crashed', false, e.stack); }
srv.kill(); mock.close(); fs.rmSync(data, { recursive: true, force: true });
const f = results.filter(r => !r.pass).length; console.log(`\n${results.length - f}/${results.length} passed`); fs.writeFileSync('tests/last-backend-run.json', JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: f, results }, null, 1)); process.exit(f ? 1 : 0);

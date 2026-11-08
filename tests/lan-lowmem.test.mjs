// (1) Optional LAN mode requires a token for non-loopback clients. (2) Memory footprint under load with a capped heap (2 GB-phone proxy).
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';

const results = []; const ok = (n, c, d = '') => { results.push({ n, pass: !!c, d }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  → ' + d}`); };
const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
const mock = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(req.url.endsWith('/models') ? { data: [{ id: 'x' }] } : { choices: [{ message: { content: 'ok' } }] })); }); });
await new Promise(r => mock.listen(0, '127.0.0.1', r)); const MB = `http://127.0.0.1:${mock.address().port}`;
const get = (host, port, p, headers = {}) => new Promise(res => { const q = http.request({ host, port, path: p, headers }, r => { r.resume(); res(r.statusCode); }); q.on('error', () => res(0)); q.end(); });
const rss = pid => Number(execSync(`ps -o rss= -p ${pid}`).toString().trim()) / 1024;

// ---- LAN ----
if (lan) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ojlan-')); const PORT = 4500 + Math.floor(Math.random() * 90);
  const srv = spawn('node', ['dist-server/server.mjs'], { env: { ...process.env, HOST: '0.0.0.0', PORT: String(PORT), OPENJARVIS_TOKEN: 'secret-token-123', OPENJARVIS_DATA: data }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1000));
  ok('LAN client without token → 401', await get(lan, PORT, '/api/providers', { host: `${lan}:${PORT}` }) === 401);
  ok('LAN client with wrong token → 401', await get(lan, PORT, '/api/providers', { 'x-openjarvis-token': 'nope' }) === 401);
  ok('LAN client with correct token → 200', await get(lan, PORT, '/api/providers', { 'x-openjarvis-token': 'secret-token-123' }) === 200);
  ok('LAN client cannot read settings without token', await get(lan, PORT, '/api/settings') === 401);
  ok('loopback client needs no token', await get('127.0.0.1', PORT, '/api/providers') === 200);
  srv.kill(); fs.rmSync(data, { recursive: true, force: true });
} else console.log('NOT TESTED  LAN auth: sandbox has no non-loopback interface');

// ---- low memory ----
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ojmem-')); const PORT = 4600 + Math.floor(Math.random() * 90);
fs.writeFileSync(path.join(data, 'keys.json'), JSON.stringify({ openai: 'GOODKEY123456' }));
fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify({ provider: 'openai' }));
const srv = spawn('node', ['--max-old-space-size=48', 'dist-server/server.mjs'], { env: { ...process.env, PORT: String(PORT), OPENJARVIS_DATA: data, OPENJARVIS_RATE_CHAT: '100000', OPENJARVIS_TEST_BASE_OPENAI: MB, OPENJARVIS_WEB: path.resolve('dist') }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const idle = rss(srv.pid); const big = 'x'.repeat(4000);
let fail = 0;
for (let i = 0; i < 300; i++) { const r = await fetch(`http://127.0.0.1:${PORT}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', text: big }, { role: 'assistant', text: big }, { role: 'user', text: big }] }) }); if (r.status !== 200) fail++; }
for (let i = 0; i < 100; i++) await fetch(`http://127.0.0.1:${PORT}/`).then(r => r.arrayBuffer());
const after = rss(srv.pid);
ok('server alive with 48 MB JS heap limit after 300 chat + 100 page requests', (() => { try { process.kill(srv.pid, 0); return true; } catch { return false; } })() && fail === 0, `fail=${fail}`);
ok(`server RSS stays small (idle ${idle.toFixed(0)} MB → ${after.toFixed(0)} MB after load; limit 120 MB)`, after < 120, `${after.toFixed(0)} MB`);
srv.kill(); mock.close(); fs.rmSync(data, { recursive: true, force: true });
const f = results.filter(r => !r.pass).length; console.log(`\n${results.length - f}/${results.length} passed`); fs.writeFileSync('tests/last-lan-lowmem-run.json', JSON.stringify({ at: new Date().toISOString(), lanTested: !!lan, total: results.length, failed: f, results }, null, 1)); process.exit(f ? 1 : 0);

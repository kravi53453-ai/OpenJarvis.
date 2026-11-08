// Model-download manager test: pause, resume (HTTP Range), SHA-256 integrity, cancel. Uses a throttled local file server.
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const results = []; const ok = (n, c, d = '') => { results.push({ n, pass: !!c, d }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  → ' + d}`); };
const FILE = crypto.randomBytes(2 * 1024 * 1024); const SHA = crypto.createHash('sha256').update(FILE).digest('hex');
let rangeRequests = 0;
const file = http.createServer((req, res) => {
  const m = /bytes=(\d+)-/.exec(req.headers.range || ''); const start = m ? Number(m[1]) : 0; if (m) rangeRequests++;
  res.writeHead(m ? 206 : 200, { 'content-length': FILE.length - start, ...(m ? { 'content-range': `bytes ${start}-${FILE.length - 1}/${FILE.length}` } : {}) });
  let pos = start; const t = setInterval(() => { if (res.destroyed) return clearInterval(t); const end = Math.min(FILE.length, pos + 32768); res.write(FILE.subarray(pos, end)); pos = end; if (pos >= FILE.length) { clearInterval(t); res.end(); } }, 25);
  res.on('close', () => clearInterval(t));
});
await new Promise(r => file.listen(0, '127.0.0.1', r)); const FU = `http://127.0.0.1:${file.address().port}/m.gguf`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ojdl-')); const PORT = 4300 + Math.floor(Math.random() * 90);
const srv = spawn('node', ['dist-server/server.mjs'], { env: { ...process.env, PORT: String(PORT), OPENJARVIS_DATA: data, OPENJARVIS_TEST_ALLOW_LOCAL_DL: '1' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1000)); const B = `http://127.0.0.1:${PORT}`;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json() }; };
const job = async f => (await call('GET', '/api/offline/models')).j.jobs.find(j => j.file === f);
const until = async (f, pred, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { const j = await job(f); if (j && pred(j)) return j; await new Promise(r => setTimeout(r, 100)); } return await job(f); };
try {
  let r = await call('POST', '/api/offline/download', { url: FU, file: 'test.gguf', sha256: SHA }); ok('download starts', r.s === 200 && r.j.state === 'running', JSON.stringify(r));
  let j = await until('test.gguf', x => x.doneBytes > 200000); ok('progress reported', j.doneBytes > 200000 && j.totalBytes === FILE.length, JSON.stringify(j));
  await call('POST', '/api/offline/download/test.gguf/pause'); await new Promise(r => setTimeout(r, 400)); j = await job('test.gguf');
  ok('pause works', j.state === 'paused', j.state); const partSize = fs.statSync(path.join(data, 'models', 'test.gguf.part')).size; ok('.part file kept on pause', partSize > 0 && partSize < FILE.length, String(partSize));
  await call('POST', '/api/offline/download/test.gguf/resume'); j = await until('test.gguf', x => x.state === 'done' || x.state === 'error');
  ok('resume completes', j.state === 'done', JSON.stringify(j)); ok('resume used HTTP Range (no restart from zero)', rangeRequests >= 1, String(rangeRequests));
  const got = fs.readFileSync(path.join(data, 'models', 'test.gguf')); ok('downloaded bytes identical to source', Buffer.compare(got, FILE) === 0);
  ok('SHA-256 verified and stored', j.sha256 === SHA && fs.readFileSync(path.join(data, 'models', 'test.gguf.sha256'), 'utf8') === SHA);
  r = await call('GET', '/api/offline/models'); ok('model listed with size', r.j.models.some(m => m.file === 'test.gguf' && m.sizeMB === 2));
  // wrong hash => integrity failure, file deleted
  await call('POST', '/api/offline/download', { url: FU, file: 'bad.gguf', sha256: 'a'.repeat(64) }); j = await until('bad.gguf', x => x.state === 'done' || x.state === 'error', 20000);
  ok('wrong SHA-256 → integrity FAILED and nothing installed', j.state === 'error' && /Integrity/.test(j.error) && !fs.existsSync(path.join(data, 'models', 'bad.gguf')), JSON.stringify(j));
  // cancel removes partial
  await call('POST', '/api/offline/download', { url: FU, file: 'cancel.gguf' }); await until('cancel.gguf', x => x.doneBytes > 50000);
  await call('POST', '/api/offline/download/cancel.gguf/cancel'); await new Promise(r => setTimeout(r, 300));
  ok('cancel deletes partial file', !fs.existsSync(path.join(data, 'models', 'cancel.gguf.part')));
  r = await call('DELETE', '/api/offline/models/test.gguf'); ok('delete installed model', r.s === 200 && !fs.existsSync(path.join(data, 'models', 'test.gguf')));
  r = await call('POST', '/api/offline/server/start', { file: 'bad.gguf' }); ok('start refuses non-installed model', r.s === 400);
} catch (e) { ok('download test crashed', false, e.stack); }
srv.kill(); file.close(); fs.rmSync(data, { recursive: true, force: true });
const f = results.filter(r => !r.pass).length; console.log(`\n${results.length - f}/${results.length} passed`); fs.writeFileSync('tests/last-download-run.json', JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: f, results }, null, 1)); process.exit(f ? 1 : 0);

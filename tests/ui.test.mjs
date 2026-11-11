// End-to-end UI test (Playwright + Chromium) against the real server and mock providers. No real keys or network.
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
let chromium; try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs')); }

const results = []; const ok = (n, c, d = '') => { results.push({ n, pass: !!c, d }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  → ' + d}`); };
const upstream = [];
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', async () => {
    const body = b ? JSON.parse(b) : null; upstream.push({ url: req.url, body });
    const j = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (!req.url.startsWith('/local') && !String(req.headers['x-goog-api-key'] || '').includes('GOODKEY123')) return j(401, {});
    if (req.url.startsWith('/gemini/models?')) return j(200, {});
    if (req.url.includes(':generateContent')) {
      const last = body.contents.at(-1); const t = last.parts.find(p => p.text)?.text || '';
      if (last.parts[0].functionResponse) return j(200, { candidates: [{ content: { parts: [{ text: 'Noted, Ravi.' }] } }] });
      if (/remember/i.test(t)) return j(200, { candidates: [{ content: { parts: [{ functionCall: { name: 'remember', args: { note: 'Ravi likes chai' } } }] } }] });
      if (/slow/i.test(t)) await new Promise(r => setTimeout(r, 1800));
      const hasImg = last.parts.some(p => p.inlineData);
      return j(200, { candidates: [{ content: { parts: [{ text: hasImg ? `I see an image (${last.parts.find(p => p.inlineData).inlineData.mimeType})` : `Gemini reply to: ${t}` }] } }] });
    }
    if (req.url.endsWith('/chat/completions')) return j(200, { choices: [{ message: { content: 'Local model reply' } }] });
    if (req.url.endsWith('/models')) return j(200, { data: [{ id: 'tiny-local' }] });
    j(404, {});
  });
});
await new Promise(r => mock.listen(0, '127.0.0.1', r)); const MB = `http://127.0.0.1:${mock.address().port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ojui-')); const PORT = 4100 + Math.floor(Math.random() * 90);
const srv = spawn('node', ['dist-server/server.mjs'], { env: { ...process.env, PORT: String(PORT), OPENJARVIS_DATA: data, GEMINI_API_KEY: '', OPENJARVIS_WEB: path.resolve('dist'), OPENJARVIS_TEST_BASE_GEMINI: `${MB}/gemini` }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
fs.mkdirSync('tests/screenshots', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, colorScheme: 'light', permissions: [] });
const page = await ctx.newPage(); const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
const U = `http://localhost:${PORT}`;
const shot = n => page.screenshot({ path: `tests/screenshots/${n}.png` });
try {
  await page.goto(U); await page.waitForSelector('text=Hi Ravi');
  ok('home shows "Hi Ravi" and OpenJarvis title', await page.locator('h1', { hasText: 'OpenJarvis' }).count() === 1);
  await page.waitForSelector('text=No API key'); ok('status pill says Cloud · No API key (honest, not fake-connected)', (await page.locator('.pill').innerText()).includes('Cloud'));
  ok('guidance to add key is shown', await page.locator('text=Add your API key in Menu → Providers').count() === 1);
  await page.fill('textarea', 'good   morning'); await page.keyboard.press('Enter');
  await page.waitForSelector('.bub.ai:has-text("Hello! I’m OpenJarvis.")');
  ok('local small talk handles repeated spaces without an API key', true);
  await shot('01-home-light');

  // Providers: save, test, use
  await page.click('[aria-label=Menu]'); await page.click('text=Providers & API keys');
  await page.waitForSelector('text=Google Gemini');
  ok('7 provider cards', await page.locator('.card h3').filter({ hasText: /Gemini|OpenAI|OpenRouter|DeepSeek|NVIDIA|Claude|ElevenLabs/ }).count() === 7);
  const gem = page.locator('.card', { has: page.locator('h3', { hasText: 'Google Gemini' }) });
  await gem.locator('input[type=password]').fill('BADKEY99999'); await gem.locator('button', { hasText: 'Save' }).click(); await gem.locator('text=Saved').first().waitFor();
  ok('key input is a password field & masked after save', (await gem.locator('.note', { hasText: 'Key:' }).innerText()).includes('••••9999'));
  await gem.locator('button', { hasText: 'Test connection' }).click(); await gem.locator('.badge', { hasText: 'Invalid key' }).waitFor(); ok('bad key → "Invalid key" badge', true);
  await gem.locator('input[type=password]').fill('GOODKEY123456'); await gem.locator('button', { hasText: 'Save' }).click(); await page.waitForTimeout(400);
  await gem.locator('button', { hasText: 'Test connection' }).click(); await gem.locator('.badge', { hasText: 'Connected' }).waitFor(); ok('good key → "Connected" badge', true);
  await shot('02-providers');
  ok('Gemini card shows "Selected for chat"', await gem.locator('button', { hasText: 'Selected for chat' }).count() === 1);
  await page.click('[aria-label=Back]'); await page.waitForSelector('.pill:has-text("Connected")'); ok('pill shows Cloud · Google Gemini · Connected', (await page.locator('.pill').innerText()).includes('Google Gemini'));

  // Chat + transcript
  await page.fill('textarea', 'hello there'); await page.keyboard.press('Enter');
  await page.waitForSelector('.bub.ai:has-text("Gemini reply to: hello there")'); ok('reply appears in visible transcript (audit #2)', true);
  ok('user bubble kept in history', await page.locator('.bub.user', { hasText: 'hello there' }).count() === 1);
  await shot('03-chat');
  // history is sent to model
  await page.fill('textarea', 'second question'); await page.keyboard.press('Enter'); await page.waitForSelector('.bub.ai:has-text("second question")');
  const lastReq = upstream.filter(u => u.url.includes(':generateContent')).at(-1).body; ok('conversation history sent to model (audit #14)', lastReq.contents.length === 3, String(lastReq.contents.length));
  // message not lost while busy
  await page.fill('textarea', 'slow one'); await page.keyboard.press('Enter'); await page.waitForSelector('text=Thinking…');
  await page.fill('textarea', 'typed while busy'); await page.keyboard.press('Enter');
  ok('text typed while busy is NOT cleared/lost (audit #12)', await page.inputValue('textarea') === 'typed while busy');
  await page.waitForSelector('.bub.ai:has-text("slow one")');
  await page.fill('textarea', ''); 
  // tool loop in browser: remember
  await page.fill('textarea', 'please remember I like chai'); await page.keyboard.press('Enter');
  await page.waitForSelector('.bub.ai:has-text("Noted, Ravi.")'); ok('tool call → result → final answer round trip in UI', await page.locator('.step.ok', { hasText: 'remember' }).count() === 1);
  await page.click('[aria-label=Menu]'); await page.click('.nav:has-text("Memory")'); await page.waitForSelector('text=Ravi likes chai'); ok('remember tool wrote real memory note', true); await shot('04-memory');
  ok('memory shows realistic storage limit, not "1 GB"', (await page.locator('body').innerText()).includes('256 KB') && !(await page.locator('body').innerText()).includes('1 GB'));
  await page.click('[aria-label=Back]');

  // image attach (both personas) with downscale
  await page.click('[aria-label=Attach]'); await page.locator('input[type=file]:not([capture])').setInputFiles('public/assets/ui_kajal.webp');
  await page.waitForSelector('.attach img'); const src = await page.getAttribute('.attach img', 'src'); ok('Kajal image attach works → downscaled JPEG data URL (audit #13)', src.startsWith('data:image/jpeg'), src.slice(0, 30));
  await page.fill('textarea', 'what is this'); await page.keyboard.press('Enter'); await page.waitForSelector('.bub.ai:has-text("I see an image (image/jpeg)")'); ok('image reaches provider as image/jpeg', true);
  // persona switch -> Adam + attach
  await page.click('[aria-label=Menu]'); await page.locator('.pers button', { hasText: 'Adam' }).click(); await page.click('.scrim', { position: { x: 350, y: 300 } });
  ok('persona switched to Adam', (await page.getAttribute('header img', 'src')).includes('ui_adam'));
  if (!(await page.locator('.menu').count())) await page.click('[aria-label=Attach]'); ok('attach menu available for Adam too', await page.locator('.menu button', { hasText: 'Photo from gallery' }).count() === 1);

  // persistence
  await page.reload(); await page.waitForSelector('.bub.user'); ok('chat history persists after reload', await page.locator('.bub.user', { hasText: 'hello there' }).count() === 1);

  // Settings: theme + low-power
  await page.click('[aria-label=Menu]'); await page.click('text=Appearance & about'); await page.waitForSelector('text=Low-power mode');
  await page.click('.seg button:has-text("Dark")'); ok('Dark theme applies', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark'); await shot('05-settings-dark');
  await page.click('.seg button:has-text("Light")'); ok('Light theme applies', await page.evaluate(() => document.documentElement.dataset.theme) === 'light');
  await page.check('text=Low-power mode >> input'); ok('Low-power mode applies', await page.evaluate(() => document.documentElement.dataset.power) === 'low');
  ok('About shows Ravi profile and honest limits', (await page.locator('body').innerText()).includes('Profile: Ravi') && (await page.locator('body').innerText()).includes('Honest limits'));
  await page.click('[aria-label=Back]');

  // Permissions in browser: honest
  await page.click('[aria-label=Menu]'); await page.click('text=Android permissions'); await page.waitForSelector('text=Browser version');
  ok('permissions screen in browser makes no fake grant buttons', await page.locator('button:has-text("Allow")').count() === 0); await shot('06-permissions-browser'); await page.click('[aria-label=Back]');

  // Offline mode: explicit switch, no cloud call
  await page.click('[aria-label=Menu]'); await page.click('text=Offline mode & models'); await page.waitForSelector('text=Model catalog');
  ok('model manager shows RAM/storage + catalog compat badges', (await page.locator('body').innerText()).includes('RAM:') && await page.locator('.badge', { hasText: /Fits|Tight|Too large|No storage/ }).count() === 3); await shot('07-offline');
  ok('missing llama-server reported honestly', (await page.locator('body').innerText()).includes('pkg install llama-cpp') || (await page.locator('body').innerText()).includes('llama-server found'));
  const ob = page.locator('#ob'); await ob.fill(`${MB}/local`); await ob.blur(); await page.waitForTimeout(500);
  await page.locator('#om').fill('tiny-local'); await page.locator('#om').blur(); await page.waitForTimeout(400);
  await page.click('button:has-text("Use Offline Mode")'); await page.waitForTimeout(600); await page.click('[aria-label=Back]');
  await page.waitForSelector('.pill:has-text("Offline")'); ok('pill shows Offline · local model · Connected', (await page.locator('.pill').innerText()).includes('Connected'));
  const n0 = upstream.filter(u => u.url.includes(':generateContent')).length;
  await page.fill('textarea', 'offline hi'); await page.keyboard.press('Enter'); await page.waitForSelector('.bub.ai:has-text("Local model reply")');
  ok('offline reply came from local server and made no cloud call', upstream.filter(u => u.url.includes(':generateContent')).length === n0);
  await page.click('[aria-label=Menu]'); await page.locator('.seg button', { hasText: 'Cloud' }).click(); await page.waitForTimeout(500); await page.click('.scrim', { position: { x: 350, y: 300 } });
  await page.waitForSelector('.pill:has-text("Google Gemini")'); ok('switching back to Cloud is explicit via menu', true);

  // Voice mode overlay renders with orb and fails gracefully without mic
  await page.click('[aria-label="Voice mode"]'); await page.waitForSelector('.voice .orb'); ok('voice mode shows animated orb overlay', true); await shot('08-voice');
  await page.click('[aria-label="Close voice mode"]');
  // layout
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); ok('no horizontal overflow at 360px width', !overflow);
  ok('no console/page errors', errors.length === 0, errors.join(' | '));
} catch (e) { ok('UI test crashed', false, e.message.split('\n').slice(0, 4).join(' ')); await shot('crash').catch(() => {}); }
await browser.close(); srv.kill(); mock.close(); fs.rmSync(data, { recursive: true, force: true });
const f = results.filter(r => !r.pass).length; console.log(`\n${results.length - f}/${results.length} passed`); fs.writeFileSync('tests/last-ui-run.json', JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: f, results }, null, 1)); process.exit(f ? 1 : 0);

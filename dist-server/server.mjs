import{createRequire as __cr}from"node:module";const require=__cr(import.meta.url);

// server/index.ts
import crypto2 from "node:crypto";
import fs3 from "node:fs";
import http2 from "node:http";
import path3 from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

// server/offline.ts
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// server/store.ts
import fs from "node:fs";
import path from "node:path";
var DATA_DIR = path.resolve(process.env.OPENJARVIS_DATA || path.join(process.cwd(), "data"));
var DEFAULT_SETTINGS = {
  mode: "cloud",
  provider: "gemini",
  models: {},
  tts: {
    provider: "device",
    geminiModel: "gemini-2.5-flash-preview-tts",
    elevenModel: "eleven_multilingual_v2",
    geminiVoices: { KAJAL: "Kore", ADAM: "Puck" },
    elevenVoices: { KAJAL: "", ADAM: "" }
  },
  offline: { baseUrl: "http://127.0.0.1:8080/v1", model: "", tools: false, vision: false, contextSize: 1024 },
  lastTest: {}
};
var ENV_KEYS = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  nvidia: "NVIDIA_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY"
};
function loadEnvFile(file = path.join(process.cwd(), ".env")) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m || line.trim().startsWith("#")) continue;
      const v = m[2].replace(/^["']|["']$/g, "");
      if (v && process.env[m[1]] === void 0) process.env[m[1]] = v;
    }
  } catch {
  }
}
function ensureDir(dir = DATA_DIR) {
  fs.mkdirSync(dir, { recursive: true, mode: 448 });
}
function readJson(file, def) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
  } catch {
    return def;
  }
}
function writeJson(file, value, mode = 384) {
  ensureDir();
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode });
  fs.renameSync(tmp, target);
  try {
    fs.chmodSync(target, mode);
  } catch {
  }
}
function merge(base, patch) {
  const out = { ...base };
  if (!patch || typeof patch !== "object") return out;
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object") out[k] = merge(cur, v);
    else if (typeof v === typeof cur || cur === void 0) out[k] = v;
  }
  return out;
}
function getSettings() {
  return merge(DEFAULT_SETTINGS, readJson("settings.json", {}));
}
function saveSettings(patch) {
  const s = merge(getSettings(), patch);
  writeJson("settings.json", s);
  return s;
}
function setKey(id, key) {
  const k = readJson("keys.json", {});
  k[id] = key;
  writeJson("keys.json", k);
}
function deleteKey(id) {
  const k = readJson("keys.json", {});
  delete k[id];
  writeJson("keys.json", k);
}
function getKey(id) {
  const fromFile = readJson("keys.json", {})[id];
  if (fromFile) return { key: fromFile, source: "app" };
  const env = process.env[ENV_KEYS[id]];
  if (env && !/^(MY_|YOUR_|CHANGE|PLACEHOLDER)/i.test(env)) return { key: env, source: "env" };
  return null;
}
function maskKey(key) {
  return key.length <= 8 ? "\u2022\u2022\u2022\u2022" : `\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${key.slice(-4)}`;
}
function modelsDir() {
  const d = path.join(DATA_DIR, "models");
  ensureDir(d);
  return d;
}

// server/types.ts
var ProviderError = class extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
  code;
  status;
};

// server/providers.ts
var PROVIDERS = {
  gemini: { id: "gemini", label: "Google Gemini", kind: "gemini", base: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-3.8-flash", keyHelp: "aistudio.google.com \u2192 Get API key" },
  openai: { id: "openai", label: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", keyHelp: "platform.openai.com \u2192 API keys" },
  openrouter: { id: "openrouter", label: "OpenRouter", kind: "openai", base: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini", keyHelp: "openrouter.ai \u2192 Keys" },
  deepseek: { id: "deepseek", label: "DeepSeek", kind: "openai", base: "https://api.deepseek.com", defaultModel: "deepseek-chat", keyHelp: "platform.deepseek.com \u2192 API keys" },
  nvidia: { id: "nvidia", label: "NVIDIA NIM", kind: "openai", base: "https://integrate.api.nvidia.com/v1", defaultModel: "meta/llama-3.1-8b-instruct", keyHelp: "build.nvidia.com \u2192 Get API key" },
  anthropic: { id: "anthropic", label: "Claude (Anthropic)", kind: "anthropic", base: "https://api.anthropic.com/v1", defaultModel: "claude-haiku-5-5", keyHelp: "console.anthropic.com \u2192 API keys" },
  elevenlabs: { id: "elevenlabs", label: "ElevenLabs (voice only)", kind: "tts", base: "https://api.elevenlabs.io/v1", defaultModel: "eleven_multilingual_v2", keyHelp: "elevenlabs.io \u2192 Profile \u2192 API keys" }
};
function baseOf(id) {
  const o = process.env[`OPENJARVIS_TEST_BASE_${id.toUpperCase()}`];
  return o || PROVIDERS[id].base;
}
async function http(url, init, timeoutMs, secret) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    const msg = e instanceof Error ? e.name === "AbortError" ? "request timed out" : e.message : "network error";
    throw new ProviderError("network", redact(`Network error: ${msg}`, secret), 502);
  } finally {
    clearTimeout(t);
  }
}
function redact(s, secret) {
  return secret ? s.split(secret).join("***") : s;
}
async function failFrom(res, secret) {
  let body = "";
  try {
    body = (await res.text()).slice(0, 300);
  } catch {
  }
  const detail = redact(body.replace(/\s+/g, " ").trim(), secret);
  if (res.status === 401 || res.status === 403) throw new ProviderError("invalid_key", `Key rejected (HTTP ${res.status}). ${detail}`, 401);
  if (res.status === 429) throw new ProviderError("rate_limited", `Rate limit or quota reached (HTTP 429). ${detail}`, 429);
  if (res.status === 400 || res.status === 404) throw new ProviderError("provider_error", `Provider rejected the request (HTTP ${res.status}). ${detail}`, 502);
  throw new ProviderError("provider_error", `Provider error (HTTP ${res.status}). ${detail}`, 502);
}
async function testConnection(id, key) {
  const p = PROVIDERS[id];
  if (!key) return { status: "not_configured", message: "No key saved." };
  const base = baseOf(id);
  let url = `${base}/models`;
  let headers = { Authorization: `Bearer ${key}` };
  if (p.kind === "gemini") {
    url = `${base}/models?pageSize=1`;
    headers = { "x-goog-api-key": key };
  }
  if (p.kind === "anthropic") headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
  if (id === "openrouter") url = `${base}/auth/key`;
  if (id === "elevenlabs") headers = { "xi-api-key": key };
  try {
    const res = await http(url, { headers }, 15e3, key);
    if (res.ok) return { status: "connected", message: "Key accepted by provider." };
    if (id === "elevenlabs" && res.status === 401) {
      const t = await res.text().catch(() => "");
      if (t.includes("missing_permissions")) return { status: "connected", message: "Key is valid but has limited permissions." };
    }
    if (res.status === 401 || res.status === 403) return { status: "invalid_key", message: `Provider rejected the key (HTTP ${res.status}).` };
    if (res.status === 429) return { status: "error", message: "Provider rate-limited the test (HTTP 429); key not verified." };
    return { status: "error", message: `Unexpected response (HTTP ${res.status}).` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Connection error" };
  }
}
function parseDataUrl(u) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(u);
  if (!m) throw new ProviderError("bad_request", "Unsupported image (use JPEG, PNG, WebP or GIF).", 400);
  return { mime: m[1], data: m[2] };
}
async function chat(o) {
  if (o.messages.some((m) => m.image) && !o.allowImages) throw new ProviderError("unsupported", 'The selected offline model is not marked as image-capable. Remove the image or enable "vision" in Offline settings.', 400);
  if (o.provider === "local") return chatOpenAI(o, o.baseUrl || "", "");
  const kind = PROVIDERS[o.provider].kind;
  if (kind === "gemini") return chatGemini(o);
  if (kind === "anthropic") return chatAnthropic(o);
  return chatOpenAI(o, baseOf(o.provider), o.key);
}
var upperTypes = (v) => Array.isArray(v) ? v.map(upperTypes) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "type" && typeof x === "string" ? x.toUpperCase() : upperTypes(x)])) : v;
function safeArgs(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
async function chatGemini(o) {
  const contents = o.messages.map((m) => {
    if (m.role === "tool") return { role: "user", parts: (m.toolResults || []).map((r) => ({ functionResponse: { name: r.name, response: { result: r.result } } })) };
    const parts = [];
    if (m.image) {
      const { mime, data } = parseDataUrl(m.image);
      parts.push({ inlineData: { mimeType: mime, data } });
    }
    if (m.text) parts.push({ text: m.text });
    for (const tc of m.toolCalls || []) parts.push(tc.raw && typeof tc.raw === "object" ? tc.raw : { functionCall: { name: tc.name, args: tc.args } });
    if (!parts.length) parts.push({ text: "(empty)" });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });
  const body = { systemInstruction: { parts: [{ text: o.system }] }, contents, generationConfig: { maxOutputTokens: 1024 } };
  if (o.tools.length) body.tools = [{ functionDeclarations: o.tools.map((t) => ({ name: t.name, description: t.description, parameters: Object.keys(t.parameters.properties).length ? upperTypes(t.parameters) : void 0 })) }];
  const res = await http(`${baseOf("gemini")}/models/${encodeURIComponent(o.model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": o.key },
    body: JSON.stringify(body)
  }, 6e4, o.key);
  if (!res.ok) await failFrom(res, o.key);
  const j = await res.json();
  const cand = j.candidates?.[0];
  if (!cand) throw new ProviderError("provider_error", `Gemini returned no answer${j.promptFeedback?.blockReason ? ` (blocked: ${j.promptFeedback.blockReason})` : ""}.`);
  const text = [];
  const toolCalls = [];
  (cand.content?.parts || []).forEach((p, i) => {
    if (typeof p.text === "string" && !p.thought) text.push(p.text);
    const fc = p.functionCall;
    if (fc?.name) toolCalls.push({ id: `fc_${Date.now()}_${i}`, name: fc.name, args: safeArgs(fc.args), raw: p });
  });
  return { text: text.join("").trim(), toolCalls };
}
async function chatOpenAI(o, base, key) {
  const messages = [{ role: "system", content: o.system }];
  for (const m of o.messages) {
    if (m.role === "tool") {
      for (const r of m.toolResults || []) messages.push({ role: "tool", tool_call_id: r.id, content: r.result });
      continue;
    }
    if (m.role === "assistant") {
      const msg2 = { role: "assistant", content: m.text || null };
      if (m.toolCalls?.length) msg2.tool_calls = m.toolCalls.map((tc) => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.args) } }));
      messages.push(msg2);
      continue;
    }
    if (m.image) {
      parseDataUrl(m.image);
      messages.push({ role: "user", content: [{ type: "image_url", image_url: { url: m.image } }, { type: "text", text: m.text || "Describe this image." }] });
    } else messages.push({ role: "user", content: m.text || "(empty)" });
  }
  const body = { model: o.model, messages, max_tokens: 1024 };
  if (o.tools.length) body.tools = o.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const headers = { "content-type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await http(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body) }, o.provider === "local" ? 18e4 : 6e4, key);
  if (!res.ok) await failFrom(res, key);
  const j = await res.json();
  const msg = j.choices?.[0]?.message;
  if (!msg) throw new ProviderError("provider_error", `Provider returned no answer${j.error?.message ? `: ${j.error.message}` : ""}.`);
  const toolCalls = (msg.tool_calls || []).filter((t) => t.function?.name).map((t, i) => {
    let args = {};
    try {
      args = safeArgs(JSON.parse(t.function?.arguments || "{}"));
    } catch {
    }
    return { id: t.id || `call_${Date.now()}_${i}`, name: t.function.name, args };
  });
  return { text: (msg.content || "").trim(), toolCalls };
}
async function chatAnthropic(o) {
  const messages = o.messages.map((m) => {
    if (m.role === "tool") return { role: "user", content: (m.toolResults || []).map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.result })) };
    const content = [];
    if (m.image) {
      const { mime, data } = parseDataUrl(m.image);
      content.push({ type: "image", source: { type: "base64", media_type: mime, data } });
    }
    if (m.text) content.push({ type: "text", text: m.text });
    for (const tc of m.toolCalls || []) content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args });
    if (!content.length) content.push({ type: "text", text: "(empty)" });
    return { role: m.role, content };
  });
  const body = { model: o.model, max_tokens: 1024, system: o.system, messages };
  if (o.tools.length) body.tools = o.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const res = await http(`${baseOf("anthropic")}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": o.key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  }, 6e4, o.key);
  if (!res.ok) await failFrom(res, o.key);
  const j = await res.json();
  const text = [];
  const toolCalls = [];
  for (const b of j.content || []) {
    if (b.type === "text" && b.text) text.push(b.text);
    if (b.type === "tool_use" && b.name && b.id) toolCalls.push({ id: b.id, name: b.name, args: safeArgs(b.input) });
  }
  return { text: text.join("").trim(), toolCalls };
}
async function pingLocal(baseUrl) {
  try {
    const res = await http(`${baseUrl.replace(/\/$/, "")}/models`, {}, 3e3);
    if (!res.ok) return { ok: false, models: [], message: `Local server answered HTTP ${res.status}.` };
    const j = await res.json();
    const models = (j.data || []).map((m) => m.id).concat((j.models || []).map((m) => m.name || m.model || "").filter(Boolean));
    return { ok: true, models, message: "Local server reachable." };
  } catch (e) {
    return { ok: false, models: [], message: e instanceof ProviderError ? "No local model server is running at this address." : "Unreachable" };
  }
}
function pcmToWav(pcm, rate = 24e3, channels = 1, bits = 16) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * bits / 8, 28);
  h.writeUInt16LE(channels * bits / 8, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
async function ttsGemini(text, voice, model, key) {
  const res = await http(`${baseOf("gemini")}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } })
  }, 6e4, key);
  if (!res.ok) await failFrom(res, key);
  const j = await res.json();
  const inl = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inl?.data) throw new ProviderError("provider_error", "Gemini returned no audio.");
  const raw = Buffer.from(inl.data, "base64");
  const mt = inl.mimeType || "";
  if (/wav|mpeg|mp3|ogg/i.test(mt)) return { mime: mt, audio: raw };
  const rate = Number(/rate=(\d+)/.exec(mt)?.[1]) || 24e3;
  return { mime: "audio/wav", audio: pcmToWav(raw, rate) };
}
async function ttsEleven(text, voiceId, model, key) {
  if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId)) throw new ProviderError("bad_request", "ElevenLabs voice ID is missing or invalid. Set it under Providers \u2192 Voice.", 400);
  const res = await http(`${baseOf("elevenlabs")}/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "content-type": "application/json", "xi-api-key": key, accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model })
  }, 6e4, key);
  if (!res.ok) await failFrom(res, key);
  return { mime: "audio/mpeg", audio: Buffer.from(await res.arrayBuffer()) };
}

// server/offline.ts
var CATALOG = [
  { id: "qwen2.5-0.5b", name: "Qwen2.5 0.5B Instruct (Q4_K_M)", file: "qwen2.5-0.5b-instruct-q4_k_m.gguf", url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf", sizeMB: 400, notes: "Smallest. Best fit for 2 GB phones. Basic chat quality, weak at tools." },
  { id: "llama3.2-1b", name: "Llama 3.2 1B Instruct (Q4_K_M)", file: "Llama-3.2-1B-Instruct-Q4_K_M.gguf", url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf", sizeMB: 810, notes: "Better quality; tight on 2 GB RAM, close other apps first." },
  { id: "qwen2.5-1.5b", name: "Qwen2.5 1.5B Instruct (Q4_K_M)", file: "qwen2.5-1.5b-instruct-q4_k_m.gguf", url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf", sizeMB: 1120, notes: "Good Hindi/English quality but too large for most 2 GB phones." }
];
var MB = 1024 * 1024;
function systemInfo() {
  let diskFreeMB = null;
  try {
    const s = fs2.statfsSync(DATA_DIR.length && fs2.existsSync(DATA_DIR) ? DATA_DIR : process.cwd());
    diskFreeMB = Math.floor(Number(s.bavail) * Number(s.bsize) / MB);
  } catch {
  }
  return { platform: process.platform, arch: process.arch, node: process.version, cpus: os.cpus().length, totalMemMB: Math.floor(os.totalmem() / MB), freeMemMB: Math.floor(os.freemem() / MB), diskFreeMB, llamaServer: findBinary("llama-server") };
}
function compat(sizeMB) {
  const sys = systemInfo();
  const need = Math.ceil(sizeMB * 1.25 + 300);
  if (sys.diskFreeMB !== null && sys.diskFreeMB < sizeMB * 1.1) return { level: "no_disk", message: `Needs ~${Math.ceil(sizeMB * 1.1)} MB free storage; only ${sys.diskFreeMB} MB free.` };
  if (sys.freeMemMB >= need) return { level: "ok", message: `Needs ~${need} MB RAM; ${sys.freeMemMB} MB free now.` };
  if (sys.totalMemMB >= need * 1.3) return { level: "tight", message: `Needs ~${need} MB RAM but only ${sys.freeMemMB} MB free now. Close other apps first.` };
  return { level: "too_large", message: `Needs ~${need} MB RAM; device has ${sys.totalMemMB} MB total. Likely to crash.` };
}
function listModels() {
  const dir = modelsDir();
  return fs2.readdirSync(dir).filter((f) => f.endsWith(".gguf")).map((f) => {
    const st = fs2.statSync(path2.join(dir, f));
    let sha = null;
    try {
      sha = fs2.readFileSync(path2.join(dir, `${f}.sha256`), "utf8").trim();
    } catch {
    }
    return { file: f, sizeMB: Math.round(st.size / MB), sha256: sha };
  });
}
function deleteModel(file) {
  if (!/^[\w.-]+\.gguf$/.test(file)) throw new Error("Invalid file name");
  if (server && serverFile === file) stopServer();
  for (const f of [file, `${file}.sha256`, `${file}.part`]) fs2.rmSync(path2.join(modelsDir(), f), { force: true });
}
var jobs = /* @__PURE__ */ new Map();
function isPrivateHost(h) {
  return /^(localhost|.*\.local)$/i.test(h) || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i.test(h);
}
function validateDownload(url, file) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  const testHook = process.env.OPENJARVIS_TEST_ALLOW_LOCAL_DL === "1";
  if (u.protocol !== "https:" && !testHook) throw new Error("Only https:// download links are allowed.");
  if (isPrivateHost(u.hostname) && !testHook) throw new Error("Downloads from local/private addresses are not allowed.");
  if (!/^[\w.-]{3,120}\.gguf$/.test(file) || file.includes("..")) throw new Error("File name must end in .gguf and use letters, digits, dot, dash or underscore.");
}
function jobList() {
  return [...jobs.values()].map(({ ctl: _c, ...j }) => j);
}
function startDownload(url, file, expectedSha, estimatedMB) {
  validateDownload(url, file);
  if (expectedSha && !/^[a-f0-9]{64}$/i.test(expectedSha)) throw new Error("SHA-256 must be 64 hex characters.");
  const existing = jobs.get(file);
  if (existing && (existing.state === "running" || existing.state === "verifying")) return strip(existing);
  const need = (estimatedMB || 0) * MB;
  const sys = systemInfo();
  if (sys.diskFreeMB !== null && estimatedMB && sys.diskFreeMB * MB < need * 1.1) throw new Error(`Not enough free storage (${sys.diskFreeMB} MB free).`);
  const job = existing || { id: file, file, url, totalBytes: 0, doneBytes: 0, state: "running" };
  Object.assign(job, { url, state: "running", error: void 0, expectedSha: expectedSha?.toLowerCase(), ctl: new AbortController() });
  jobs.set(file, job);
  void runDownload(job);
  return strip(job);
}
var strip = (j) => {
  const { ctl: _c, ...r } = j;
  return r;
};
async function runDownload(job) {
  const dir = modelsDir();
  const part = path2.join(dir, `${job.file}.part`);
  try {
    const have = fs2.existsSync(part) ? fs2.statSync(part).size : 0;
    const res = await fetch(job.url, { headers: have ? { Range: `bytes=${have}-` } : {}, redirect: "follow", signal: job.ctl.signal });
    if (!res.ok || !res.body) throw new Error(`Server answered HTTP ${res.status}`);
    const resumed = res.status === 206 && have > 0;
    const start = resumed ? have : 0;
    const len = Number(res.headers.get("content-length") || 0);
    job.totalBytes = len ? start + len : 0;
    job.doneBytes = start;
    const out = fs2.createWriteStream(part, { flags: resumed ? "a" : "w" });
    const src = Readable.fromWeb(res.body);
    src.on("data", (c) => {
      job.doneBytes += c.length;
    });
    await pipeline(src, out);
    job.state = "verifying";
    const final = path2.join(dir, job.file);
    const hash = crypto.createHash("sha256");
    await pipeline(fs2.createReadStream(part), hash);
    job.sha256 = hash.digest("hex");
    if (job.totalBytes && fs2.statSync(part).size !== job.totalBytes) throw new Error("Downloaded size does not match the server-reported size.");
    if (job.expectedSha && job.expectedSha !== job.sha256) {
      fs2.rmSync(part, { force: true });
      throw new Error("Integrity check FAILED: SHA-256 does not match. File deleted.");
    }
    fs2.renameSync(part, final);
    fs2.writeFileSync(`${final}.sha256`, job.sha256);
    job.state = "done";
  } catch (e) {
    if (job.ctl?.signal.aborted && job.state !== "error") {
      if (job.state === "running") job.state = "paused";
      return;
    }
    job.state = "error";
    job.error = e instanceof Error ? e.message : "Download failed";
  }
}
function pauseDownload(file) {
  const j = jobs.get(file);
  if (j && j.state === "running") {
    j.state = "paused";
    j.ctl?.abort();
  }
}
function cancelDownload(file) {
  const j = jobs.get(file);
  if (j) {
    j.state = "error";
    j.error = "Cancelled";
    j.ctl?.abort();
    jobs.delete(file);
  }
  if (/^[\w.-]+\.gguf$/.test(file)) fs2.rmSync(path2.join(modelsDir(), `${file}.part`), { force: true });
}
function clearPartials() {
  let n = 0;
  for (const f of fs2.readdirSync(modelsDir())) if (f.endsWith(".part") && ![...jobs.values()].some((j) => j.file + ".part" === f && j.state === "running")) {
    fs2.rmSync(path2.join(modelsDir(), f), { force: true });
    n++;
  }
  return n;
}
var server = null;
var serverFile = "";
var serverState = "stopped";
var logTail = [];
function findBinary(name) {
  for (const d of (process.env.PATH || "").split(path2.delimiter)) {
    const p = path2.join(d, name);
    try {
      fs2.accessSync(p, fs2.constants.X_OK);
      return p;
    } catch {
    }
  }
  return null;
}
function startServer(file, ctx = 1024, port = 8080) {
  if (!/^[\w.-]+\.gguf$/.test(file) || !fs2.existsSync(path2.join(modelsDir(), file))) throw new Error("Model file not found. Download it first.");
  const bin = findBinary("llama-server");
  if (!bin) throw new Error("llama-server not found. In Termux run: pkg install llama-cpp");
  const c = Math.min(4096, Math.max(512, Math.floor(ctx)));
  if (server) stopServer();
  logTail.length = 0;
  serverState = "starting";
  serverFile = file;
  server = spawn(bin, ["-m", path2.join(modelsDir(), file), "--host", "127.0.0.1", "--port", String(port), "-c", String(c), "-t", String(Math.max(1, Math.min(4, os.cpus().length)))], { stdio: ["ignore", "pipe", "pipe"] });
  const push = (b) => {
    for (const l of b.toString().split("\n")) if (l.trim()) {
      logTail.push(l.slice(0, 200));
      if (logTail.length > 40) logTail.shift();
    }
  };
  server.stdout?.on("data", push);
  server.stderr?.on("data", push);
  server.on("exit", (code) => {
    if (serverState !== "stopped") {
      serverState = code === 0 ? "stopped" : "error";
    }
    server = null;
  });
  server.on("error", (e) => {
    serverState = "error";
    logTail.push(`spawn error: ${e.message}`);
    server = null;
  });
  saveSettings({ offline: { baseUrl: `http://127.0.0.1:${port}/v1`, model: file, contextSize: c } });
}
function stopServer() {
  serverState = "stopped";
  try {
    server?.kill("SIGTERM");
  } catch {
  }
  server = null;
}
process.on("exit", () => {
  try {
    server?.kill("SIGTERM");
  } catch {
  }
});
async function offlineStatus() {
  const s = getSettings().offline;
  const ping = await pingLocal(s.baseUrl);
  if (serverState === "starting" && ping.ok) serverState = "running";
  return { baseUrl: s.baseUrl, model: s.model, reachable: ping.ok, message: ping.message, serverModels: ping.models, managedServer: { state: serverState, file: serverFile, log: logTail.slice(-8) }, settings: s };
}

// server/tools.ts
var S = (description, enumv) => ({ type: "string", description, ...enumv ? { enum: enumv } : {} });
var N = (description) => ({ type: "number", description });
var CORE_TOOLS = [
  { name: "remember", description: "Save a short fact about the user to local memory.", parameters: { type: "object", properties: { note: S("The fact to remember") }, required: ["note"] } },
  { name: "recall", description: "Search local memory for saved facts.", parameters: { type: "object", properties: { query: S("Search words") }, required: ["query"] } }
];
var NATIVE_TOOLS = [
  { name: "open_app", description: "Launch an installed app by its visible name.", parameters: { type: "object", properties: { app_name: S("App name, e.g. WhatsApp") }, required: ["app_name"] } },
  { name: "read_screen", description: "Read the visible UI of the current app (text, buttons, coordinates). Call before tap/type. Password fields are hidden.", parameters: { type: "object", properties: {} } },
  { name: "tap", description: "Tap an element by visible text/description, or by x,y pixel coordinates from read_screen.", parameters: { type: "object", properties: { text: S("Visible text or content description"), x: N("X pixel"), y: N("Y pixel") } } },
  { name: "long_press", description: "Long press an element by text or x,y.", parameters: { type: "object", properties: { text: S("Visible text"), x: N("X pixel"), y: N("Y pixel") } } },
  { name: "swipe", description: "Swipe between two points.", parameters: { type: "object", properties: { x1: N("Start X"), y1: N("Start Y"), x2: N("End X"), y2: N("End Y"), duration_ms: N("Duration, default 300") }, required: ["x1", "y1", "x2", "y2"] } },
  { name: "scroll", description: "Scroll the current screen.", parameters: { type: "object", properties: { direction: S("Direction", ["up", "down"]) }, required: ["direction"] } },
  { name: "type_text", description: "Type text into the focused (or first) editable field.", parameters: { type: "object", properties: { text: S("Text to enter") }, required: ["text"] } },
  { name: "press", description: "Press a system button.", parameters: { type: "object", properties: { button: S("Button", ["back", "home", "recents", "notifications"]) }, required: ["button"] } },
  { name: "find_contact", description: "Search the user's contacts by name (needs Contacts permission).", parameters: { type: "object", properties: { query: S("Name to search") }, required: ["query"] } },
  { name: "call_phone", description: "Start a phone call. Android shows a confirmation dialog to the user with the name and number; nothing is dialed unless the user confirms.", parameters: { type: "object", properties: { number: S("Phone number"), name: S("Contact name if known") }, required: ["number"] } },
  { name: "open_camera", description: "Open the real camera screen with a live preview. auto_capture starts a visible 3-second countdown.", parameters: { type: "object", properties: { mode: S("photo or video", ["photo", "video"]), lens: S("front or rear", ["front", "rear"]), auto_capture: S("true to capture after countdown", ["true", "false"]) } } },
  { name: "take_screenshot", description: "Capture the screen (Android shows its own screen-capture consent each session).", parameters: { type: "object", properties: {} } },
  { name: "get_location", description: "Get the last known location (needs Location permission).", parameters: { type: "object", properties: {} } },
  { name: "show_notification", description: "Show a notification from OpenJarvis.", parameters: { type: "object", properties: { title: S("Title"), text: S("Body") }, required: ["title", "text"] } },
  { name: "read_clipboard", description: "Read the clipboard (Android only allows this while OpenJarvis is in the foreground).", parameters: { type: "object", properties: {} } },
  { name: "set_clipboard", description: "Copy text to the clipboard.", parameters: { type: "object", properties: { text: S("Text") }, required: ["text"] } },
  { name: "share_text", description: "Open the Android share sheet with some text.", parameters: { type: "object", properties: { text: S("Text to share") }, required: ["text"] } },
  { name: "open_url", description: "Open an http/https link in the browser.", parameters: { type: "object", properties: { url: S("URL") }, required: ["url"] } },
  { name: "pick_file", description: "Ask the user to pick a file; returns name, size and (for small text files) content.", parameters: { type: "object", properties: {} } },
  { name: "bluetooth_status", description: "Report Bluetooth on/off and paired device names (needs Nearby devices permission).", parameters: { type: "object", properties: {} } }
];
function toolsFor(native) {
  return native ? [...CORE_TOOLS, ...NATIVE_TOOLS] : CORE_TOOLS;
}
function buildSystemPrompt(persona, native, memory, userName = "Ravi") {
  const who = persona === "KAJAL" ? "Kajal, a warm and sharp female assistant" : "Adam, a calm and capable male assistant";
  return [
    `You are ${who} inside the OpenJarvis app. The user's name is ${userName}.`,
    "Reply in the language the user uses (Hindi, English or Hinglish). Keep replies short and conversational; they may be spoken aloud, so avoid markdown tables and long lists.",
    native ? "You run inside the native Android app and can use the provided tools to act on the real phone. Use read_screen before tapping or typing. Work step by step, stop and tell the user when a step fails, and never claim an action succeeded unless the tool result says so. Ask the user before anything involving money, passwords, deleting data or sending messages. Calls always need the user's on-screen confirmation." : "This session runs in a web browser: you have NO access to the phone, screen, camera or contacts. Never claim to have performed phone actions; say what the user can do instead.",
    'Only "remember" and "recall" touch local memory. Never invent tool results.',
    memory ? `Saved memory about the user:
${memory.slice(0, 3e3)}` : ""
  ].filter(Boolean).join("\n\n");
}

// server/index.ts
loadEnvFile();
var PORT = Number(process.env.PORT || 3e3);
var HOST = process.env.HOST || "127.0.0.1";
var LAN = !["127.0.0.1", "localhost", "::1"].includes(HOST);
var MAX_BODY = Number(process.env.OPENJARVIS_MAX_BODY || 6 * 1024 * 1024);
var WEB_DIR = path3.resolve(process.env.OPENJARVIS_WEB || path3.join(path3.dirname(fileURLToPath(import.meta.url)), "..", "dist"));
var TOKEN = process.env.OPENJARVIS_TOKEN || "";
if (LAN && !TOKEN) {
  TOKEN = crypto2.randomBytes(16).toString("hex");
}
var HttpError = class extends Error {
  constructor(status, message, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
};
var isLoopback = (a) => !!a && (a === "::1" || a.startsWith("127.") || a === "::ffff:127.0.0.1");
function send(res, status, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, "Request too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "Invalid JSON"));
      }
    });
    req.on("error", () => reject(new HttpError(400, "Read error")));
  });
}
var hits = /* @__PURE__ */ new Map();
function rateLimit(ip, bucket, max) {
  const k = `${ip}|${bucket}`;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < 6e4);
  if (arr.length >= max) throw new HttpError(429, "Too many requests, slow down.", "rate_limited");
  arr.push(now);
  hits.set(k, arr);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some((t) => now - t < 6e4)) hits.delete(k);
}, 6e4).unref();
var str = (v, max, name, required = true) => {
  if (v === void 0 || v === null || v === "") {
    if (required) throw new HttpError(400, `${name} is required`);
    return "";
  }
  if (typeof v !== "string") throw new HttpError(400, `${name} must be text`);
  if (v.length > max) throw new HttpError(400, `${name} too long`);
  return v;
};
var isProvider = (v) => typeof v === "string" && v in PROVIDERS;
var isChatProvider = (v) => isProvider(v) && v !== "elevenlabs";
function parseMessages(v) {
  if (!Array.isArray(v) || !v.length) throw new HttpError(400, "messages required");
  if (v.length > 60) throw new HttpError(400, "too many messages");
  let chars = 0;
  return v.map((m) => {
    if (!m || typeof m !== "object") throw new HttpError(400, "bad message");
    const r = m;
    if (r.role !== "user" && r.role !== "assistant" && r.role !== "tool") throw new HttpError(400, "bad role");
    const out = { role: r.role };
    if (r.text !== void 0) {
      out.text = str(r.text, 2e4, "text", false);
      chars += out.text.length;
    }
    if (r.image !== void 0 && r.image !== null) {
      out.image = str(r.image, 25e5, "image");
    }
    if (Array.isArray(r.toolCalls)) out.toolCalls = r.toolCalls.slice(0, 8).map((t) => ({ id: str(t.id, 120, "tool id"), name: str(t.name, 60, "tool name"), args: t.args && typeof t.args === "object" ? t.args : {}, raw: t.raw }));
    if (Array.isArray(r.toolResults)) out.toolResults = r.toolResults.slice(0, 8).map((t) => ({ id: str(t.id, 120, "tool id"), name: str(t.name, 60, "tool name"), result: str(t.result, 12e3, "tool result", false) }));
    if (chars > 12e4) throw new HttpError(400, "conversation too long");
    return out;
  });
}
function providerCard(id) {
  const s = getSettings();
  const k = getKey(id);
  const last = s.lastTest[id];
  return {
    id,
    label: PROVIDERS[id].label,
    keyHelp: PROVIDERS[id].keyHelp,
    isChat: id !== "elevenlabs",
    model: s.models[id] || PROVIDERS[id].defaultModel,
    defaultModel: PROVIDERS[id].defaultModel,
    configured: !!k,
    source: k?.source ?? null,
    masked: k ? maskKey(k.key) : "",
    status: !k ? "not_configured" : last?.status ?? "untested",
    message: last?.message ?? "",
    testedAt: last?.at ?? null
  };
}
async function api(req, res, url) {
  const ip = req.socket.remoteAddress || "?";
  const route = `${req.method} ${url.pathname}`;
  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, "Cross-origin request blocked", "forbidden");
  }
  if (route === "GET /api/health") return send(res, 200, { ok: true, app: "OpenJarvis", lan: LAN, tokenRequired: !isLoopback(ip) });
  if (route === "GET /api/status") {
    const s = getSettings();
    if (s.mode === "offline") {
      const o = await offlineStatus();
      return send(res, 200, { mode: "offline", provider: "local", model: s.offline.model || o.serverModels[0] || "", status: o.reachable ? "connected" : "error", message: o.message, user: "Ravi" });
    }
    const c = providerCard(s.provider);
    return send(res, 200, { mode: "cloud", provider: s.provider, label: c.label, model: c.model, status: c.status, message: c.message, user: "Ravi" });
  }
  if (route === "GET /api/settings") return send(res, 200, getSettings());
  if (route === "PUT /api/settings") {
    const b = await readBody(req);
    const patch = {};
    if (b.mode !== void 0) {
      if (b.mode !== "cloud" && b.mode !== "offline") throw new HttpError(400, "mode must be cloud or offline");
      patch.mode = b.mode;
    }
    if (b.provider !== void 0) {
      if (!isChatProvider(b.provider)) throw new HttpError(400, "unknown provider");
      patch.provider = b.provider;
    }
    if (b.tts && typeof b.tts === "object") {
      const t = b.tts;
      const tp = {};
      if (t.provider !== void 0) {
        if (!["device", "gemini", "elevenlabs"].includes(t.provider)) throw new HttpError(400, "bad tts provider");
        tp.provider = t.provider;
      }
      for (const k of ["geminiModel", "elevenModel"]) if (t[k] !== void 0) tp[k] = str(t[k], 80, k);
      for (const k of ["geminiVoices", "elevenVoices"]) if (t[k] && typeof t[k] === "object") {
        const o = t[k];
        tp[k] = { KAJAL: str(o.KAJAL, 60, k, false), ADAM: str(o.ADAM, 60, k, false) };
      }
      patch.tts = tp;
    }
    if (b.offline && typeof b.offline === "object") {
      const o = b.offline;
      const op = {};
      if (o.baseUrl !== void 0) {
        const u = str(o.baseUrl, 200, "baseUrl");
        try {
          const p = new URL(u);
          if (!/^https?:$/.test(p.protocol)) throw new Error();
        } catch {
          throw new HttpError(400, "baseUrl must be http(s)://host:port/v1");
        }
        op.baseUrl = u;
      }
      if (o.model !== void 0) op.model = str(o.model, 160, "model", false);
      if (o.tools !== void 0) op.tools = o.tools === true;
      if (o.vision !== void 0) op.vision = o.vision === true;
      if (o.contextSize !== void 0) op.contextSize = Math.min(4096, Math.max(512, Number(o.contextSize) || 1024));
      patch.offline = op;
    }
    return send(res, 200, saveSettings(patch));
  }
  if (route === "GET /api/providers") return send(res, 200, Object.keys(PROVIDERS).map(providerCard));
  const pm = /^(PUT|DELETE|POST) \/api\/providers\/([a-z]+)(?:\/(test))?$/.exec(route);
  if (pm) {
    const id = pm[2];
    if (!isProvider(id)) throw new HttpError(404, "Unknown provider", "not_found");
    if (pm[1] === "POST" && pm[3] === "test") {
      rateLimit(ip, "test", 20);
      const k = getKey(id);
      const r = await testConnection(id, k?.key || "");
      saveSettings({ lastTest: { [id]: { status: r.status, at: Date.now(), message: r.message } } });
      return send(res, 200, providerCard(id));
    }
    if (pm[1] === "PUT" && !pm[3]) {
      const b = await readBody(req);
      if (b.key !== void 0 && b.key !== "") {
        const key = str(b.key, 400, "key").trim();
        if (/\s/.test(key) || key.length < 8) throw new HttpError(400, "That does not look like an API key.");
        setKey(id, key);
        saveSettings({ lastTest: { [id]: { status: "untested", at: Date.now(), message: "Key saved. Press Test connection." } } });
      }
      if (b.model !== void 0) saveSettings({ models: { [id]: str(b.model, 160, "model", false) || PROVIDERS[id].defaultModel } });
      return send(res, 200, providerCard(id));
    }
    if (pm[1] === "DELETE" && !pm[3]) {
      deleteKey(id);
      return send(res, 200, providerCard(id));
    }
  }
  if (route === "POST /api/chat") {
    rateLimit(ip, "chat", Number(process.env.OPENJARVIS_RATE_CHAT) || 40);
    const b = await readBody(req);
    const messages = parseMessages(b.messages);
    const persona = b.persona === "ADAM" ? "ADAM" : "KAJAL";
    const native = b.nativeTools === true;
    const system = buildSystemPrompt(persona, native, str(b.memoryContext, 6e3, "memoryContext", false));
    const s = getSettings();
    if (s.mode === "offline") {
      const model2 = s.offline.model || (await pingLocal(s.offline.baseUrl)).models[0] || "";
      if (!model2) throw new HttpError(503, "Offline Mode is on but no local model server is running. Open Menu \u2192 Offline Mode.", "offline_unavailable");
      const reply2 = await chat({ provider: "local", baseUrl: s.offline.baseUrl, model: model2, key: "", system, messages, tools: s.offline.tools ? toolsFor(native) : [], allowImages: s.offline.vision });
      return send(res, 200, { ok: true, ...reply2, mode: "offline", provider: "local", model: model2 });
    }
    const k = getKey(s.provider);
    if (!k) throw new ProviderError("not_configured", `${PROVIDERS[s.provider].label} has no API key. Open Menu \u2192 Providers and add your key.`, 400);
    const model = s.models[s.provider] || PROVIDERS[s.provider].defaultModel;
    const reply = await chat({ provider: s.provider, model, key: k.key, system, messages, tools: toolsFor(native), allowImages: true });
    return send(res, 200, { ok: true, ...reply, mode: "cloud", provider: s.provider, model });
  }
  if (route === "POST /api/tts") {
    rateLimit(ip, "tts", 40);
    const b = await readBody(req);
    const text = str(b.text, 1500, "text");
    const persona = b.persona === "ADAM" ? "ADAM" : "KAJAL";
    const s = getSettings();
    if (s.mode === "offline") throw new HttpError(409, "Cloud voice is disabled in Offline Mode; using the device voice.", "offline_mode");
    if (s.tts.provider === "gemini") {
      const k = getKey("gemini");
      if (!k) throw new ProviderError("not_configured", "Gemini key missing for voice.", 400);
      const r = await ttsGemini(text, s.tts.geminiVoices[persona], s.tts.geminiModel, k.key);
      return send(res, 200, { mime: r.mime, audio: r.audio.toString("base64"), voice: "gemini" });
    }
    if (s.tts.provider === "elevenlabs") {
      const k = getKey("elevenlabs");
      if (!k) throw new ProviderError("not_configured", "ElevenLabs key missing.", 400);
      const r = await ttsEleven(text, s.tts.elevenVoices[persona], s.tts.elevenModel, k.key);
      return send(res, 200, { mime: r.mime, audio: r.audio.toString("base64"), voice: "elevenlabs" });
    }
    throw new HttpError(409, "Device voice selected.", "device_voice");
  }
  if (route === "GET /api/offline/status") return send(res, 200, await offlineStatus());
  if (route === "GET /api/offline/system") return send(res, 200, systemInfo());
  if (route === "GET /api/offline/catalog") return send(res, 200, CATALOG.map((c) => ({ ...c, compat: compat(c.sizeMB), installed: listModels().some((m) => m.file === c.file) })));
  if (route === "GET /api/offline/models") return send(res, 200, { models: listModels(), jobs: jobList() });
  if (route === "POST /api/offline/download") {
    const b = await readBody(req);
    let url2, file, size;
    if (typeof b.catalogId === "string") {
      const c = CATALOG.find((x) => x.id === b.catalogId);
      if (!c) throw new HttpError(404, "Unknown catalog entry");
      url2 = c.url;
      file = c.file;
      size = c.sizeMB;
    } else {
      url2 = str(b.url, 500, "url");
      file = str(b.file, 120, "file");
    }
    try {
      return send(res, 200, startDownload(url2, file, typeof b.sha256 === "string" && b.sha256 ? b.sha256 : void 0, size));
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Download rejected");
    }
  }
  const dm = /^POST \/api\/offline\/download\/([\w.-]+)\/(pause|resume|cancel)$/.exec(route);
  if (dm) {
    const file = dm[1];
    if (dm[2] === "pause") pauseDownload(file);
    else if (dm[2] === "cancel") cancelDownload(file);
    else {
      const j = jobList().find((x) => x.file === file);
      if (!j) throw new HttpError(404, "No such download");
      try {
        startDownload(j.url, file, j.expectedSha);
      } catch (e) {
        throw new HttpError(400, e instanceof Error ? e.message : "Cannot resume");
      }
    }
    return send(res, 200, { jobs: jobList() });
  }
  if (route === "POST /api/offline/clear-partials") return send(res, 200, { removed: clearPartials() });
  const del = /^DELETE \/api\/offline\/models\/([\w.-]+)$/.exec(route);
  if (del) {
    try {
      deleteModel(del[1]);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Delete failed");
    }
    return send(res, 200, { models: listModels() });
  }
  if (route === "POST /api/offline/server/start") {
    const b = await readBody(req);
    try {
      startServer(str(b.file, 120, "file"), Number(b.contextSize) || getSettings().offline.contextSize);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Cannot start");
    }
    return send(res, 200, await offlineStatus());
  }
  if (route === "POST /api/offline/server/stop") {
    stopServer();
    return send(res, 200, await offlineStatus());
  }
  throw new HttpError(404, "Not found", "not_found");
}
var MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
var gz = /* @__PURE__ */ new Map();
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.includes("\0")) throw new HttpError(400, "Bad path");
  let file = path3.join(WEB_DIR, rel === "/" ? "index.html" : rel);
  if (!file.startsWith(WEB_DIR + path3.sep) && file !== WEB_DIR) throw new HttpError(403, "Forbidden", "forbidden");
  if (!fs3.existsSync(file) || fs3.statSync(file).isDirectory()) {
    if (path3.extname(rel)) throw new HttpError(404, "Not found", "not_found");
    file = path3.join(WEB_DIR, "index.html");
  }
  if (!fs3.existsSync(file)) throw new HttpError(503, "Web UI is not built. Run: npm run build", "not_built");
  const ext = path3.extname(file);
  const headers = {
    "content-type": MIME[ext] || "application/octet-stream",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": ext === ".html" ? "no-cache" : "public, max-age=86400",
    "content-security-policy": "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"
  };
  let body = fs3.readFileSync(file);
  if (/\.(html|js|css|svg|json)$/.test(ext) && /gzip/.test(String(req.headers["accept-encoding"]))) {
    const key = `${file}:${fs3.statSync(file).mtimeMs}`;
    let z = gz.get(key);
    if (!z) {
      z = zlib.gzipSync(body);
      gz.set(key, z);
    }
    body = z;
    headers["content-encoding"] = "gzip";
    headers.vary = "accept-encoding";
  }
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? void 0 : body);
}
var server2 = http2.createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url || "/", "http://x");
      const ip = req.socket.remoteAddress || "";
      const hostHdr = String(req.headers.host || "");
      if (!LAN && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(hostHdr)) throw new HttpError(403, "Unexpected Host header", "forbidden");
      if (url.pathname.startsWith("/api/")) {
        if (!isLoopback(ip)) {
          const given = String(req.headers["x-openjarvis-token"] || "");
          const a = Buffer.from(given), b = Buffer.from(TOKEN);
          if (!TOKEN || a.length !== b.length || !crypto2.timingSafeEqual(a, b)) {
            if (url.pathname !== "/api/health") throw new HttpError(401, "Access token required", "unauthorized");
          }
        }
        return await api(req, res, url);
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed");
      serveStatic(req, res, url);
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (e instanceof HttpError) return send(res, e.status, { ok: false, code: e.code, error: e.message });
      if (e instanceof ProviderError) return send(res, e.status, { ok: false, code: e.code, error: e.message });
      console.error("Unhandled error:", e instanceof Error ? e.message : e);
      send(res, 500, { ok: false, code: "internal", error: "Internal error" });
    }
  })();
});
if (!process.env.OPENJARVIS_NO_LISTEN) {
  server2.listen(PORT, HOST, () => {
    console.log(`OpenJarvis server \u2192 http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}  (data: ${DATA_DIR})`);
    if (LAN) console.log(`LAN access is ON. Access token (needed by other devices): ${TOKEN}`);
    else console.log("Listening on this device only (127.0.0.1). Set HOST=0.0.0.0 to allow other devices (token required).");
  });
}
export {
  server2 as server
};

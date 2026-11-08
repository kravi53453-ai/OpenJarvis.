import { ProviderError } from './types.js';
import type { ChatProviderId, ChatReply, KeyStatus, ProviderId, ToolCall, ToolDef, WireMsg } from './types.js';

type Kind = 'gemini' | 'openai' | 'anthropic' | 'tts';
export interface ProviderInfo { id: ProviderId; label: string; kind: Kind; base: string; defaultModel: string; keyHelp: string }

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: { id: 'gemini', label: 'Google Gemini', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-3.8-flash', keyHelp: 'aistudio.google.com → Get API key' },
  openai: { id: 'openai', label: 'OpenAI', kind: 'openai', base: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', keyHelp: 'platform.openai.com → API keys' },
  openrouter: { id: 'openrouter', label: 'OpenRouter', kind: 'openai', base: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini', keyHelp: 'openrouter.ai → Keys' },
  deepseek: { id: 'deepseek', label: 'DeepSeek', kind: 'openai', base: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', keyHelp: 'platform.deepseek.com → API keys' },
  nvidia: { id: 'nvidia', label: 'NVIDIA NIM', kind: 'openai', base: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.1-8b-instruct', keyHelp: 'build.nvidia.com → Get API key' },
  anthropic: { id: 'anthropic', label: 'Claude (Anthropic)', kind: 'anthropic', base: 'https://api.anthropic.com/v1', defaultModel: 'claude-haiku-5-5', keyHelp: 'console.anthropic.com → API keys' },
  elevenlabs: { id: 'elevenlabs', label: 'ElevenLabs (voice only)', kind: 'tts', base: 'https://api.elevenlabs.io/v1', defaultModel: 'eleven_multilingual_v2', keyHelp: 'elevenlabs.io → Profile → API keys' },
};

/** Test hook: lets automated tests point providers at a local mock server. Never set in production. */
function baseOf(id: ProviderId): string {
  const o = process.env[`OPENJARVIS_TEST_BASE_${id.toUpperCase()}`];
  return o || PROVIDERS[id].base;
}

async function http(url: string, init: RequestInit, timeoutMs: number, secret?: string): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: ctl.signal }); }
  catch (e) {
    const msg = e instanceof Error ? (e.name === 'AbortError' ? 'request timed out' : e.message) : 'network error';
    throw new ProviderError('network', redact(`Network error: ${msg}`, secret), 502);
  } finally { clearTimeout(t); }
}

function redact(s: string, secret?: string): string { return secret ? s.split(secret).join('***') : s; }

async function failFrom(res: Response, secret?: string): Promise<never> {
  let body = '';
  try { body = (await res.text()).slice(0, 300); } catch { /* ignore */ }
  const detail = redact(body.replace(/\s+/g, ' ').trim(), secret);
  if (res.status === 401 || res.status === 403) throw new ProviderError('invalid_key', `Key rejected (HTTP ${res.status}). ${detail}`, 401);
  if (res.status === 429) throw new ProviderError('rate_limited', `Rate limit or quota reached (HTTP 429). ${detail}`, 429);
  if (res.status === 400 || res.status === 404) throw new ProviderError('provider_error', `Provider rejected the request (HTTP ${res.status}). ${detail}`, 502);
  throw new ProviderError('provider_error', `Provider error (HTTP ${res.status}). ${detail}`, 502);
}

// ---------- connection test ----------
export async function testConnection(id: ProviderId, key: string): Promise<{ status: KeyStatus; message: string }> {
  const p = PROVIDERS[id];
  if (!key) return { status: 'not_configured', message: 'No key saved.' };
  const base = baseOf(id);
  let url = `${base}/models`;
  let headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (p.kind === 'gemini') { url = `${base}/models?pageSize=1`; headers = { 'x-goog-api-key': key }; }
  if (p.kind === 'anthropic') headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (id === 'openrouter') url = `${base}/auth/key`; // /models is public on OpenRouter, so it would not validate the key
  if (id === 'elevenlabs') headers = { 'xi-api-key': key };
  try {
    const res = await http(url, { headers }, 15000, key);
    if (res.ok) return { status: 'connected', message: 'Key accepted by provider.' };
    if (id === 'elevenlabs' && res.status === 401) {
      const t = await res.text().catch(() => '');
      if (t.includes('missing_permissions')) return { status: 'connected', message: 'Key is valid but has limited permissions.' };
    }
    if (res.status === 401 || res.status === 403) return { status: 'invalid_key', message: `Provider rejected the key (HTTP ${res.status}).` };
    if (res.status === 429) return { status: 'error', message: 'Provider rate-limited the test (HTTP 429); key not verified.' };
    return { status: 'error', message: `Unexpected response (HTTP ${res.status}).` };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Connection error' };
  }
}

// ---------- chat ----------
export interface ChatOpts {
  provider: ChatProviderId | 'local';
  baseUrl?: string; // local only
  model: string;
  key: string;
  system: string;
  messages: WireMsg[];
  tools: ToolDef[];
  allowImages: boolean;
}

function parseDataUrl(u: string): { mime: string; data: string } {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(u);
  if (!m) throw new ProviderError('bad_request', 'Unsupported image (use JPEG, PNG, WebP or GIF).', 400);
  return { mime: m[1], data: m[2] };
}

export async function chat(o: ChatOpts): Promise<ChatReply> {
  if (o.messages.some(m => m.image) && !o.allowImages) throw new ProviderError('unsupported', 'The selected offline model is not marked as image-capable. Remove the image or enable "vision" in Offline settings.', 400);
  if (o.provider === 'local') return chatOpenAI(o, o.baseUrl || '', '');
  const kind = PROVIDERS[o.provider].kind;
  if (kind === 'gemini') return chatGemini(o);
  if (kind === 'anthropic') return chatAnthropic(o);
  return chatOpenAI(o, baseOf(o.provider), o.key);
}

const upperTypes = (v: unknown): unknown => Array.isArray(v) ? v.map(upperTypes)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'type' && typeof x === 'string' ? x.toUpperCase() : upperTypes(x)])) : v;

function safeArgs(v: unknown): Record<string, unknown> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; }

async function chatGemini(o: ChatOpts): Promise<ChatReply> {
  const contents = o.messages.map(m => {
    if (m.role === 'tool') return { role: 'user', parts: (m.toolResults || []).map(r => ({ functionResponse: { name: r.name, response: { result: r.result } } })) };
    const parts: unknown[] = [];
    if (m.image) { const { mime, data } = parseDataUrl(m.image); parts.push({ inlineData: { mimeType: mime, data } }); }
    if (m.text) parts.push({ text: m.text });
    for (const tc of m.toolCalls || []) parts.push(tc.raw && typeof tc.raw === 'object' ? tc.raw : { functionCall: { name: tc.name, args: tc.args } });
    if (!parts.length) parts.push({ text: '(empty)' });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
  const body: Record<string, unknown> = { systemInstruction: { parts: [{ text: o.system }] }, contents, generationConfig: { maxOutputTokens: 1024 } };
  if (o.tools.length) body.tools = [{ functionDeclarations: o.tools.map(t => ({ name: t.name, description: t.description, parameters: Object.keys(t.parameters.properties).length ? upperTypes(t.parameters) : undefined })) }];
  const res = await http(`${baseOf('gemini')}/models/${encodeURIComponent(o.model)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': o.key }, body: JSON.stringify(body),
  }, 60000, o.key);
  if (!res.ok) await failFrom(res, o.key);
  const j = await res.json() as { candidates?: { content?: { parts?: Record<string, unknown>[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
  const cand = j.candidates?.[0];
  if (!cand) throw new ProviderError('provider_error', `Gemini returned no answer${j.promptFeedback?.blockReason ? ` (blocked: ${j.promptFeedback.blockReason})` : ''}.`);
  const text: string[] = []; const toolCalls: ToolCall[] = [];
  (cand.content?.parts || []).forEach((p, i) => {
    if (typeof p.text === 'string' && !p.thought) text.push(p.text);
    const fc = p.functionCall as { name?: string; args?: unknown } | undefined;
    if (fc?.name) toolCalls.push({ id: `fc_${Date.now()}_${i}`, name: fc.name, args: safeArgs(fc.args), raw: p });
  });
  return { text: text.join('').trim(), toolCalls };
}

async function chatOpenAI(o: ChatOpts, base: string, key: string): Promise<ChatReply> {
  const messages: unknown[] = [{ role: 'system', content: o.system }];
  for (const m of o.messages) {
    if (m.role === 'tool') { for (const r of m.toolResults || []) messages.push({ role: 'tool', tool_call_id: r.id, content: r.result }); continue; }
    if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: m.text || null };
      if (m.toolCalls?.length) msg.tool_calls = m.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args) } }));
      messages.push(msg); continue;
    }
    if (m.image) { parseDataUrl(m.image); messages.push({ role: 'user', content: [{ type: 'image_url', image_url: { url: m.image } }, { type: 'text', text: m.text || 'Describe this image.' }] }); }
    else messages.push({ role: 'user', content: m.text || '(empty)' });
  }
  const body: Record<string, unknown> = { model: o.model, messages, max_tokens: 1024 };
  if (o.tools.length) body.tools = o.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await http(`${base.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, o.provider === 'local' ? 180000 : 60000, key);
  if (!res.ok) await failFrom(res, key);
  const j = await res.json() as { choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[]; error?: { message?: string } };
  const msg = j.choices?.[0]?.message;
  if (!msg) throw new ProviderError('provider_error', `Provider returned no answer${j.error?.message ? `: ${j.error.message}` : ''}.`);
  const toolCalls: ToolCall[] = (msg.tool_calls || []).filter(t => t.function?.name).map((t, i) => {
    let args: Record<string, unknown> = {};
    try { args = safeArgs(JSON.parse(t.function?.arguments || '{}')); } catch { /* keep {} */ }
    return { id: t.id || `call_${Date.now()}_${i}`, name: t.function!.name!, args };
  });
  return { text: (msg.content || '').trim(), toolCalls };
}

async function chatAnthropic(o: ChatOpts): Promise<ChatReply> {
  const messages = o.messages.map(m => {
    if (m.role === 'tool') return { role: 'user', content: (m.toolResults || []).map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.result })) };
    const content: unknown[] = [];
    if (m.image) { const { mime, data } = parseDataUrl(m.image); content.push({ type: 'image', source: { type: 'base64', media_type: mime, data } }); }
    if (m.text) content.push({ type: 'text', text: m.text });
    for (const tc of m.toolCalls || []) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
    if (!content.length) content.push({ type: 'text', text: '(empty)' });
    return { role: m.role, content };
  });
  const body: Record<string, unknown> = { model: o.model, max_tokens: 1024, system: o.system, messages };
  if (o.tools.length) body.tools = o.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const res = await http(`${baseOf('anthropic')}/messages`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': o.key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body),
  }, 60000, o.key);
  if (!res.ok) await failFrom(res, o.key);
  const j = await res.json() as { content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] };
  const text: string[] = []; const toolCalls: ToolCall[] = [];
  for (const b of j.content || []) {
    if (b.type === 'text' && b.text) text.push(b.text);
    if (b.type === 'tool_use' && b.name && b.id) toolCalls.push({ id: b.id, name: b.name, args: safeArgs(b.input) });
  }
  return { text: text.join('').trim(), toolCalls };
}

// ---------- local model server reachability ----------
export async function pingLocal(baseUrl: string): Promise<{ ok: boolean; models: string[]; message: string }> {
  try {
    const res = await http(`${baseUrl.replace(/\/$/, '')}/models`, {}, 3000);
    if (!res.ok) return { ok: false, models: [], message: `Local server answered HTTP ${res.status}.` };
    const j = await res.json() as { data?: { id: string }[]; models?: { name?: string; model?: string }[] };
    const models = (j.data || []).map(m => m.id).concat((j.models || []).map(m => m.name || m.model || '').filter(Boolean));
    return { ok: true, models, message: 'Local server reachable.' };
  } catch (e) { return { ok: false, models: [], message: e instanceof ProviderError ? 'No local model server is running at this address.' : 'Unreachable' }; }
}

// ---------- text to speech ----------
export function pcmToWav(pcm: Buffer, rate = 24000, channels = 1, bits = 16): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * bits / 8, 28); h.writeUInt16LE(channels * bits / 8, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function ttsGemini(text: string, voice: string, model: string, key: string): Promise<{ mime: string; audio: Buffer }> {
  const res = await http(`${baseOf('gemini')}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
  }, 60000, key);
  if (!res.ok) await failFrom(res, key);
  const j = await res.json() as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
  const inl = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)?.inlineData;
  if (!inl?.data) throw new ProviderError('provider_error', 'Gemini returned no audio.');
  const raw = Buffer.from(inl.data, 'base64');
  const mt = inl.mimeType || '';
  if (/wav|mpeg|mp3|ogg/i.test(mt)) return { mime: mt, audio: raw };
  const rate = Number(/rate=(\d+)/.exec(mt)?.[1]) || 24000; // Gemini returns raw 16-bit PCM
  return { mime: 'audio/wav', audio: pcmToWav(raw, rate) };
}

export async function ttsEleven(text: string, voiceId: string, model: string, key: string): Promise<{ mime: string; audio: Buffer }> {
  if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId)) throw new ProviderError('bad_request', 'ElevenLabs voice ID is missing or invalid. Set it under Providers → Voice.', 400);
  const res = await http(`${baseOf('elevenlabs')}/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': key, accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: model }),
  }, 60000, key);
  if (!res.ok) await failFrom(res, key);
  return { mime: 'audio/mpeg', audio: Buffer.from(await res.arrayBuffer()) };
}

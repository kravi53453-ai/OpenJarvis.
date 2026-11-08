import fs from 'node:fs';
import path from 'node:path';
import type { ChatProviderId, KeyStatus, ProviderId } from './types.js';

export const DATA_DIR = path.resolve(process.env.OPENJARVIS_DATA || path.join(process.cwd(), 'data'));

export interface Settings {
  mode: 'cloud' | 'offline';
  provider: ChatProviderId;
  models: Partial<Record<ProviderId, string>>;
  tts: {
    provider: 'device' | 'gemini' | 'elevenlabs';
    geminiModel: string;
    elevenModel: string;
    geminiVoices: { KAJAL: string; ADAM: string };
    elevenVoices: { KAJAL: string; ADAM: string };
  };
  offline: { baseUrl: string; model: string; tools: boolean; vision: boolean; contextSize: number };
  lastTest: Partial<Record<ProviderId, { status: KeyStatus; at: number; message?: string }>>;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'cloud',
  provider: 'gemini',
  models: {},
  tts: {
    provider: 'device',
    geminiModel: 'gemini-2.5-flash-preview-tts',
    elevenModel: 'eleven_multilingual_v2',
    geminiVoices: { KAJAL: 'Kore', ADAM: 'Puck' },
    elevenVoices: { KAJAL: '', ADAM: '' },
  },
  offline: { baseUrl: 'http://127.0.0.1:8080/v1', model: '', tools: false, vision: false, contextSize: 1024 },
  lastTest: {},
};

const ENV_KEYS: Record<ProviderId, string> = {
  gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', openrouter: 'OPENROUTER_API_KEY', deepseek: 'DEEPSEEK_API_KEY',
  nvidia: 'NVIDIA_API_KEY', anthropic: 'ANTHROPIC_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY',
};

/** Minimal .env loader (no dependency). Never overrides real environment variables. */
export function loadEnvFile(file = path.join(process.cwd(), '.env')): void {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m || line.trim().startsWith('#')) continue;
      const v = m[2].replace(/^["']|["']$/g, '');
      if (v && process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch { /* no .env file */ }
}

function ensureDir(dir = DATA_DIR): void { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }

function readJson<T>(file: string, def: T): T {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')) as T; } catch { return def; }
}

function writeJson(file: string, value: unknown, mode = 0o600): void {
  ensureDir();
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode });
  fs.renameSync(tmp, target);
  try { fs.chmodSync(target, mode); } catch { /* not supported on some filesystems */ }
}

function merge<T extends object>(base: T, patch: unknown): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (!patch || typeof patch !== 'object') return out as T;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const cur = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object') out[k] = merge(cur as object, v);
    else if (typeof v === typeof cur || cur === undefined) out[k] = v;
  }
  return out as T;
}

export function getSettings(): Settings { return merge(DEFAULT_SETTINGS, readJson<unknown>('settings.json', {})); }
export function saveSettings(patch: unknown): Settings { const s = merge(getSettings(), patch); writeJson('settings.json', s); return s; }

type KeyFile = Partial<Record<ProviderId, string>>;
export function setKey(id: ProviderId, key: string): void { const k = readJson<KeyFile>('keys.json', {}); k[id] = key; writeJson('keys.json', k); }
export function deleteKey(id: ProviderId): void { const k = readJson<KeyFile>('keys.json', {}); delete k[id]; writeJson('keys.json', k); }

export function getKey(id: ProviderId): { key: string; source: 'app' | 'env' } | null {
  const fromFile = readJson<KeyFile>('keys.json', {})[id];
  if (fromFile) return { key: fromFile, source: 'app' };
  const env = process.env[ENV_KEYS[id]];
  if (env && !/^(MY_|YOUR_|CHANGE|PLACEHOLDER)/i.test(env)) return { key: env, source: 'env' };
  return null;
}

/** Only ever shows the last 4 characters. */
export function maskKey(key: string): string { return key.length <= 8 ? '••••' : `••••••••${key.slice(-4)}`; }
export function modelsDir(): string { const d = path.join(DATA_DIR, 'models'); ensureDir(d); return d; }

import type { KeyStatus, Msg, ProviderCard, Settings, Status, ToolCall } from './types';

const TOKEN_KEY = 'oj_lan_token';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setToken = (t: string) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } };

export class ApiError extends Error { constructor(public code: string, message: string, public status: number) { super(message); } }

export async function req<T>(method: string, path: string, body?: unknown, timeoutMs = 90000): Promise<T> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const tok = getToken();
    const r = await fetch(path, { method, signal: ctl.signal, headers: { 'content-type': 'application/json', ...(tok ? { 'x-openjarvis-token': tok } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(j.code || 'error', j.error || `Server error ${r.status}`, r.status);
    return j as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new ApiError('timeout', 'The request timed out.', 0);
    throw new ApiError('network', 'Cannot reach the OpenJarvis server. Is it running in Termux?', 0);
  } finally { clearTimeout(t); }
}

export interface WireMsg { role: 'user' | 'assistant' | 'tool'; text?: string; image?: string; toolCalls?: ToolCall[]; toolResults?: { id: string; name: string; result: string }[] }
export interface ChatReply { ok: true; text: string; toolCalls: ToolCall[]; mode: string; provider: string; model: string }

export const api = {
  status: () => req<Status>('GET', '/api/status', undefined, 8000),
  settings: () => req<Settings>('GET', '/api/settings'),
  saveSettings: (patch: unknown) => req<Settings>('PUT', '/api/settings', patch),
  providers: () => req<ProviderCard[]>('GET', '/api/providers'),
  saveProvider: (id: string, body: { key?: string; model?: string }) => req<ProviderCard>('PUT', `/api/providers/${id}`, body),
  deleteKey: (id: string) => req<ProviderCard>('DELETE', `/api/providers/${id}`),
  testProvider: (id: string) => req<ProviderCard>('POST', `/api/providers/${id}/test`, undefined, 30000),
  chat: (messages: WireMsg[], persona: string, memoryContext: string, nativeTools: boolean) => req<ChatReply>('POST', '/api/chat', { messages, persona, memoryContext, nativeTools }, 200000),
  tts: (text: string, persona: string) => req<{ mime: string; audio: string; voice: string }>('POST', '/api/tts', { text, persona }, 60000),
};
export type { KeyStatus, Msg };

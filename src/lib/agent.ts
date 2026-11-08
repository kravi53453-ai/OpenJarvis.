import { api, ApiError } from './api';
import type { WireMsg } from './api';
import { memory } from './memory';
import { isNative, nativeExec, resumeAutomation, setAutomationActive } from './native';
import type { Msg, PersonaId, ToolCall, ToolResult } from './types';

export const MAX_STEPS = 10;
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newMsg = (role: Msg['role'], text: string, extra: Partial<Msg> = {}): Msg => ({ id: uid(), role, text, ts: Date.now(), ...extra });

/** Last N turns, starting at a user message so tool call/response pairs are never orphaned. */
export function toWire(msgs: Msg[], n = 24): WireMsg[] {
  let slice = msgs.filter(m => !m.error).slice(-n);
  const first = slice.findIndex(m => m.role === 'user'); slice = first < 0 ? [] : slice.slice(first);
  const lastImg = [...slice].reverse().find(m => m.image)?.id;
  return slice.map(m => ({
    role: m.role, text: m.text || undefined, image: m.id === lastImg ? m.image : undefined,
    toolCalls: m.toolCalls, toolResults: m.toolResults?.map(r => ({ id: r.id, name: r.name, result: r.result })),
  }));
}

const INTERACTIVE = new Set(['open_camera', 'call_phone', 'pick_file', 'take_screenshot']);

async function runTool(tc: ToolCall): Promise<ToolResult> {
  const a = tc.args;
  try {
    if (tc.name === 'remember') { memory.add(String(a.note || ''), 'ai'); return { id: tc.id, name: tc.name, ok: true, result: 'Saved to local memory.' }; }
    if (tc.name === 'recall') { const r = memory.search(String(a.query || '')); return { id: tc.id, name: tc.name, ok: true, result: r.length ? r.map(n => n.text).join('\n') : 'Nothing found.' }; }
    if (!isNative()) return { id: tc.id, name: tc.name, ok: false, result: 'Not available: phone control needs the OpenJarvis Android app.' };
    const r = await nativeExec(tc.name, a, INTERACTIVE.has(tc.name) ? 300000 : 30000);
    const text = r.ok ? (typeof r.result === 'string' ? r.result : JSON.stringify(r.result ?? 'ok')) : `FAILED: ${r.error || 'unknown error'}`;
    return { id: tc.id, name: tc.name, ok: r.ok, result: text.slice(0, 6000) };
  } catch (e) { return { id: tc.id, name: tc.name, ok: false, result: `FAILED: ${e instanceof Error ? e.message : 'error'}` }; }
}

export interface RunCtl { stopped: boolean }
/** Runs one user request: model call → (tool calls → results → model call)* → final answer. Returns the final text. */
export async function runAgent(history: Msg[], persona: PersonaId, push: (m: Msg) => void, ctl: RunCtl): Promise<string> {
  const all = [...history];
  const add = (m: Msg) => { all.push(m); push(m); };
  resumeAutomation();
  let svc = false; // visible foreground notification (with Stop) only while phone tools are in use
  try {
  for (let step = 0; step < MAX_STEPS; step++) {
    if (ctl.stopped) { add(newMsg('assistant', 'Stopped.', {})); return 'Stopped.'; }
    let reply;
    try { reply = await api.chat(toWire(all), persona, memory.context(), isNative()); }
    catch (e) { const t = e instanceof ApiError ? e.message : 'Something went wrong.'; add(newMsg('assistant', t, { error: true })); return t; }
    if (!reply.toolCalls.length) { const t = reply.text || '(no reply)'; add(newMsg('assistant', t)); return t; }
    add(newMsg('assistant', reply.text, { toolCalls: reply.toolCalls }));
    const results: ToolResult[] = [];
    if (!svc && isNative() && reply.toolCalls.some(t => t.name !== 'remember' && t.name !== 'recall')) { svc = true; setAutomationActive(true); }
    for (const tc of reply.toolCalls) { if (ctl.stopped) { results.push({ id: tc.id, name: tc.name, ok: false, result: 'Stopped by user.' }); continue; } results.push(await runTool(tc)); }
    add(newMsg('tool', '', { toolResults: results }));
  }
  const t = `I stopped after ${MAX_STEPS} steps to be safe. Tell me if you want me to continue.`;
  add(newMsg('assistant', t)); return t;
  } finally { if (svc) setAutomationActive(false); }
}

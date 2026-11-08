import { load, save } from './storage';

export interface Note { id: string; ts: number; text: string; by: 'user' | 'ai' }
const KEY = 'oj_memory_v2';
/** Realistic cap: browser localStorage is typically ~5 MB shared by the whole app. */
export const MEMORY_LIMIT_BYTES = 256 * 1024;
let notes: Note[] = load<Note[]>(KEY, []);
let bytes = notes.reduce((n, x) => n + x.text.length * 2 + 40, 0);

const persist = () => save(KEY, notes);
export const memory = {
  all: (): Note[] => notes,
  usedBytes: (): number => bytes,
  add(text: string, by: Note['by'] = 'ai'): Note {
    const clean = text.trim().slice(0, 500);
    const n: Note = { id: `${Date.now()}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), text: clean, by };
    notes.push(n); bytes += clean.length * 2 + 40;
    while (bytes > MEMORY_LIMIT_BYTES && notes.length > 1) { const o = notes.shift()!; bytes -= o.text.length * 2 + 40; }
    persist(); return n;
  },
  remove(id: string) { const i = notes.findIndex(n => n.id === id); if (i >= 0) { bytes -= notes[i].text.length * 2 + 40; notes.splice(i, 1); persist(); } },
  clear() { notes = []; bytes = 0; persist(); },
  search(q: string): Note[] { const w = q.toLowerCase().split(/\s+/).filter(Boolean); return notes.filter(n => w.some(x => n.text.toLowerCase().includes(x))).slice(-8); },
  context(): string { return notes.slice(-25).map(n => `- ${n.text}`).join('\n').slice(-2500); },
};

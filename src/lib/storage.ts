export function load<T>(key: string, def: T): T { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : def; } catch { return def; } }
export function save(key: string, value: unknown): boolean { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
const timers = new Map<string, number>();
/** Debounced save so a burst of changes writes once (cheap on low-end phones). */
export function saveSoon(key: string, get: () => unknown, ms = 600): void {
  const t = timers.get(key); if (t) clearTimeout(t);
  timers.set(key, window.setTimeout(() => { timers.delete(key); save(key, get()); }, ms));
}

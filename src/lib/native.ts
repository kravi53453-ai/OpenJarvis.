// Bridge to the real Android app (WebView JavascriptInterface "OJNative"). In a normal browser every call reports "not native".
interface Bridge {
  isNative(): boolean; getVersion(): string; isLowRam(): boolean; getPermissions(): string; requestPermission(name: string): void; openAppSettings(): void;
  exec(callId: string, tool: string, argsJson: string): void; listen(lang: string): void; stopListen(): void; speak(text: string, persona: string): void; stopSpeak(): void;
  stopAutomation(): void; resumeAutomation(): void; setAutomationActive(on: boolean): void; readImageBase64(path: string, maxDim: number): string; saveToGallery(path: string): string;
  getBackendUrl(): string; setBackendUrl(url: string): void;
}
declare global { interface Window { OJNative?: Bridge; __oj?: { onResult: (id: string, json: string) => void; onEvent: (json: string) => void } } }

export interface NativeEvent { type: string; [k: string]: unknown }
const listeners = new Set<(e: NativeEvent) => void>();
const pending = new Map<string, (r: { ok: boolean; result?: unknown; error?: string }) => void>();

window.__oj = {
  onResult: (id, json) => { const f = pending.get(id); if (f) { pending.delete(id); try { f(JSON.parse(json)); } catch { f({ ok: false, error: 'Bad native response' }); } } },
  onEvent: json => { try { const e = JSON.parse(json) as NativeEvent; listeners.forEach(l => l(e)); } catch { /* ignore */ } },
};

export const isNative = (): boolean => { try { return !!window.OJNative && window.OJNative.isNative(); } catch { return false; } };
export const onNativeEvent = (f: (e: NativeEvent) => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const nativeVersion = () => (isNative() ? window.OJNative!.getVersion() : '');
export const isLowRamDevice = () => { try { return isNative() && window.OJNative!.isLowRam(); } catch { return false; } };

export type PermState = 'granted' | 'not_granted' | 'on_request' | 'unsupported';
export const getPermissions = (): Record<string, PermState> => { try { return isNative() ? JSON.parse(window.OJNative!.getPermissions()) : {}; } catch { return {}; } };
export const requestPermission = (name: string) => { if (isNative()) window.OJNative!.requestPermission(name); };
export const openAppSettings = () => { if (isNative()) window.OJNative!.openAppSettings(); };
export const stopAutomation = () => { if (isNative()) window.OJNative!.stopAutomation(); };
export const resumeAutomation = () => { if (isNative()) window.OJNative!.resumeAutomation(); };
export const setAutomationActive = (on: boolean) => { try { if (isNative()) window.OJNative!.setAutomationActive(on); } catch { /* ignore */ } };
export const readImage = (path: string, maxDim = 1024): string => (isNative() ? window.OJNative!.readImageBase64(path, maxDim) : '');
export const saveToGallery = (path: string): string => (isNative() ? window.OJNative!.saveToGallery(path) : 'Not available in the browser');
export const nativeListen = (lang: string) => window.OJNative?.listen(lang);
export const nativeStopListen = () => window.OJNative?.stopListen();
export const nativeSpeak = (t: string, p: string) => window.OJNative?.speak(t, p);
export const nativeStopSpeak = () => window.OJNative?.stopSpeak();
export const getBackendUrl = () => (isNative() ? window.OJNative!.getBackendUrl() : location.origin);
export const setBackendUrl = (u: string) => window.OJNative?.setBackendUrl(u);

export function nativeExec(tool: string, args: Record<string, unknown>, timeoutMs = 60000): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  if (!isNative()) return Promise.resolve({ ok: false, error: 'Phone control needs the OpenJarvis Android app. This is the browser version.' });
  return new Promise(resolve => {
    const id = `${tool}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const t = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: 'Timed out waiting for Android.' }); }, timeoutMs);
    pending.set(id, r => { clearTimeout(t); resolve(r); });
    try { window.OJNative!.exec(id, tool, JSON.stringify(args)); } catch (e) { clearTimeout(t); pending.delete(id); resolve({ ok: false, error: e instanceof Error ? e.message : 'Bridge error' }); }
  });
}

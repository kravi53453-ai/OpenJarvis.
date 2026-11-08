import { isLowRamDevice } from './native';
import { load, save } from './storage';
import type { PersonaId } from './types';

export interface Prefs { theme: 'system' | 'light' | 'dark'; lowPower: boolean; persona: PersonaId; voiceLang: string; speakReplies: boolean; onboarded: boolean; skipped: string[] }
const KEY = 'oj_prefs_v2';
function defaults(): Prefs {
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return { theme: 'system', lowPower: isLowRamDevice() || (dm !== undefined && dm <= 2), persona: 'KAJAL', voiceLang: 'hi-IN', speakReplies: false, onboarded: false, skipped: [] };
}
export const loadPrefs = (): Prefs => ({ ...defaults(), ...load<Partial<Prefs>>(KEY, {}) });
export const savePrefs = (p: Prefs) => save(KEY, p);
export function applyPrefs(p: Prefs): void {
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.power = p.lowPower ? 'low' : 'normal';
}

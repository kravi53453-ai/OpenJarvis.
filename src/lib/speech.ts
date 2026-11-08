import { api, ApiError } from './api';
import { isNative, nativeListen, nativeSpeak, nativeStopListen, nativeStopSpeak, onNativeEvent } from './native';
import type { PersonaId } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ListenHandlers { onPartial: (t: string) => void; onFinal: (t: string) => void; onError: (code: string, msg: string) => void; onEnd: () => void }
let handlers: ListenHandlers | null = null;
let rec: any = null;
let ttsDone: (() => void) | null = null;
let audio: HTMLAudioElement | null = null;

onNativeEvent(e => {
  if (e.type === 'stt_partial') handlers?.onPartial(String(e.text || ''));
  else if (e.type === 'stt_final') handlers?.onFinal(String(e.text || ''));
  else if (e.type === 'stt_error') handlers?.onError(String(e.code || 'error'), String(e.message || 'Speech recognition error'));
  else if (e.type === 'stt_end') handlers?.onEnd();
  else if (e.type === 'tts_done') { const d = ttsDone; ttsDone = null; d?.(); }
});

const SR = (): any => (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
export const sttSupported = (): boolean => isNative() || !!SR();

const errMsg: Record<string, string> = {
  'not-allowed': 'Microphone permission was denied. Allow it in Android settings → Apps → OpenJarvis → Permissions.',
  'service-not-allowed': 'Speech service is not allowed on this device.',
  network: 'Speech recognition needs an internet connection (Chrome sends audio to Google). Type instead, or reconnect.',
  'no-speech': 'I did not hear anything.', 'audio-capture': 'No microphone available.', insecure: 'Voice input in the browser only works on http://localhost or https. Open http://localhost:3000 on this phone.',
  unsupported: 'This browser has no speech recognition. Use Chrome, or the OpenJarvis Android app.',
};

export function startListening(lang: string, h: ListenHandlers): void {
  stopListening(); handlers = h;
  if (isNative()) { nativeListen(lang); return; }
  const C = SR();
  if (!C) { h.onError('unsupported', errMsg.unsupported); h.onEnd(); return; }
  if (!window.isSecureContext) { h.onError('insecure', errMsg.insecure); h.onEnd(); return; }
  let finalText = ''; let ended = false;
  rec = new C(); rec.lang = lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  rec.onresult = (e: any) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; } h.onPartial(finalText + interim); };
  rec.onerror = (e: any) => { h.onError(e.error, errMsg[e.error] || `Speech error: ${e.error}`); };
  rec.onend = () => { if (ended) return; ended = true; if (finalText.trim()) h.onFinal(finalText.trim()); h.onEnd(); };
  try { rec.start(); } catch { h.onError('error', 'Could not start the microphone.'); h.onEnd(); }
}

export function stopListening(): void {
  try { rec?.abort(); } catch { /* already stopped */ }
  rec = null;
  if (isNative()) nativeStopListen();
}

function clean(t: string): string { return t.replace(/```[\s\S]*?```/g, ' ').replace(/https?:\/\/\S+/g, ' link ').replace(/[*_#`>|~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 1200); }

const FEMALE = /female|woman|zira|hazel|heera|kalpana|swara|neerja|samantha|aria|jenny|veena|lekha|google.*hi-in-x-hia/i;
const MALE = /\bmale\b|david|mark\b|ravi|hemant|prabhat|madhur|guy\b|rishi|daniel|google.*hi-in-x-hic/i;

function pickVoice(persona: PersonaId): SpeechSynthesisVoice | null {
  const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
  const want = persona === 'KAJAL' ? FEMALE : MALE;
  const ranked = (l: RegExp) => vs.filter(v => l.test(v.lang));
  for (const pool of [ranked(/^hi/i), ranked(/^en-IN/i), ranked(/^en/i), vs]) { const g = pool.find(v => want.test(v.name)); if (g) return g; }
  return null; // no gender-labelled voice: caller falls back to pitch differences
}

function deviceSpeak(text: string, persona: PersonaId): Promise<void> {
  if (isNative()) return new Promise(res => { ttsDone = res; nativeSpeak(text, persona); setTimeout(() => { if (ttsDone === res) { ttsDone = null; res(); } }, 90000); });
  if (!('speechSynthesis' in window)) return Promise.reject(new Error('No text-to-speech available'));
  return new Promise(res => {
    const u = new SpeechSynthesisUtterance(text); const v = pickVoice(persona);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
    u.pitch = persona === 'KAJAL' ? 1.15 : 0.8; u.rate = 1;
    u.onend = () => res(); u.onerror = () => res();
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  });
}

function playAudio(mime: string, b64: string): Promise<void> {
  return new Promise((res, rej) => {
    const a = new Audio(`data:${mime};base64,${b64}`); audio = a;
    a.onended = () => { audio = null; res(); };
    a.onerror = () => { audio = null; rej(new Error('Audio could not be played')); };
    a.play().catch(rej);
  });
}

export interface SpeakResult { via: 'cloud' | 'device'; notice?: string }
/** cloud=true tries the configured cloud voice first; any failure is reported via `notice` and the device voice is used. */
export async function speak(text: string, persona: PersonaId, cloud: boolean): Promise<SpeakResult> {
  const t = clean(text); if (!t) return { via: 'device' };
  let notice: string | undefined;
  if (cloud) {
    try { const r = await api.tts(t, persona); await playAudio(r.mime, r.audio); return { via: 'cloud' }; }
    catch (e) { if (!(e instanceof ApiError && (e.code === 'device_voice' || e.code === 'offline_mode'))) notice = `Cloud voice failed (${e instanceof Error ? e.message : 'error'}). Used device voice.`; }
  }
  try { await deviceSpeak(t, persona); } catch (e) { notice = (notice ? notice + ' ' : '') + (e instanceof Error ? e.message : 'No voice output available'); }
  return { via: 'device', notice };
}

export function stopSpeaking(): void {
  try { audio?.pause(); } catch { /* ignore */ }
  audio = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (isNative()) nativeStopSpeak();
  const d = ttsDone; ttsDone = null; d?.();
}

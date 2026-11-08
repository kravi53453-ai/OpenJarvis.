import { useEffect, useRef, useState } from 'react';
import { sttSupported, speak, startListening, stopListening, stopSpeaking } from '../lib/speech';
import type { PersonaId } from '../lib/types';
import { Icon } from './Icon';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
interface Props { persona: PersonaId; lang: string; cloudVoice: boolean; send: (text: string) => Promise<string>; onClose: () => void; onStopAll: () => void }

/** Hands-free loop: listen → send → speak → listen. The microphone is closed while the assistant speaks (no self-hearing) and the loop stops after 3 empty turns or any error (no restart storms). */
export default function VoiceMode({ persona, lang, cloudVoice, send, onClose, onStopAll }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const active = useRef(false); const empties = useRef(0); const heard = useRef(''); const failed = useRef(false);

  const halt = () => { active.current = false; stopListening(); stopSpeaking(); setPhase('idle'); };
  const listen = () => {
    if (!active.current) return;
    heard.current = ''; failed.current = false; setPhase('listening'); setText('');
    startListening(lang, {
      onPartial: t => setText(t),
      onFinal: t => { heard.current = t; },
      onError: (code, msg) => { if (code === 'no-speech') return; failed.current = true; setError(msg); },
      onEnd: () => { void afterListen(); },
    });
  };
  const afterListen = async () => {
    if (!active.current) return;
    if (failed.current) { halt(); return; }
    const t = heard.current.trim();
    if (!t) { if (++empties.current >= 3) { setError('I did not hear anything, so I stopped listening. Tap the orb to start again.'); halt(); return; } setTimeout(listen, 350); return; }
    empties.current = 0; setText(t); setPhase('thinking');
    const reply = await send(t);
    if (!active.current) return;
    setPhase('speaking'); setText(reply);
    const r = await speak(reply, persona, cloudVoice);
    if (r.notice) setError(r.notice);
    if (active.current) listen();
  };
  const toggle = () => { if (active.current) { halt(); onStopAll(); } else { setError(''); empties.current = 0; active.current = true; listen(); } };
  useEffect(() => { if (!sttSupported()) setError('Speech recognition is not available here. Use Chrome on localhost, or the OpenJarvis Android app.'); return () => { active.current = false; stopListening(); stopSpeaking(); }; }, []);
  const label = { idle: 'Tap the orb to talk', listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…' }[phase];
  return (
    <div className="voice" role="dialog" aria-label="Voice mode">
      <button className="iconbtn" style={{ position: 'absolute', top: 12, right: 12 }} onClick={() => { halt(); onClose(); }} aria-label="Close voice mode"><Icon name="x" /></button>
      <img src={persona === 'ADAM' ? '/assets/ui_adam.webp' : '/assets/ui_kajal.webp'} alt="" width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }} />
      <button className={`orb ${phase}`} onClick={toggle} aria-label={phase === 'idle' ? 'Start voice' : 'Stop voice'}><Icon name={phase === 'idle' ? 'mic' : 'stop'} size={44} /></button>
      <div className="vs">{label}</div>
      <div className="vt">{text}</div>
      {error && <div className="warnbox" style={{ maxWidth: 420 }}>{error}</div>}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { sttSupported, speak, startListening, stopListening, stopSpeaking } from '../lib/speech';
import type { PersonaId } from '../lib/types';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
interface Props { persona: PersonaId; lang: string; cloudVoice: boolean; send: (text: string) => Promise<string>; onClose: () => void; onStopAll: () => void }

/** Hands-free loop: listen → send → speak → listen. */
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
    if (!t) { if (++empties.current >= 3) { setError('I did not hear anything. Tap the orb to try again.'); halt(); return; } window.setTimeout(listen, 700); return; }
    empties.current = 0; setText(t); setPhase('thinking');
    let reply: string;
    try {
      reply = await send(t);
    } catch (e) {
      if (!active.current) return;
      setError(e instanceof Error ? e.message : 'Could not send the voice message. Check your connection and try again.');
      halt();
      return;
    }
    if (!active.current) return;
    setPhase('speaking'); setText(reply);
    try {
      const r = await speak(reply, persona, cloudVoice);
      if (r.notice) setError(r.notice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice playback failed. Tap Start to try again.');
      halt();
      return;
    }
    if (active.current) listen();
  };
  const toggle = () => { if (active.current) { halt(); onStopAll(); } else { setError(''); empties.current = 0; active.current = true; listen(); } };
  useEffect(() => { if (!sttSupported()) setError('Speech recognition is not available here. Use Chrome on localhost, or the OpenJarvis Android app.'); return () => { active.current = false; stopListening(); stopSpeaking(); }; }, []);
  const label = { idle: 'Tap to talk', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' }[phase];
  return (
    <div className="voice voice-neon" role="dialog" aria-label="OpenJarvis voice chat">
      <div className="voice-top">
        <div className="voice-persona">
          <img src={persona === 'ADAM' ? '/assets/ui_adam.webp' : '/assets/ui_kajal.webp'} alt={persona === 'ADAM' ? 'Adam' : 'Kajal'} />
          <div><strong>{persona === 'ADAM' ? 'Adam' : 'Kajal'}</strong><span>OpenJarvis</span></div>
        </div>
        <button className="iconbtn voice-close" onClick={() => { halt(); onClose(); }} aria-label="Close voice mode">×</button>
      </div>
      <div className="voice-center">
        <button className={`voice-energy-orb ${phase}`} onClick={toggle} aria-label={phase === 'idle' ? 'Start voice' : 'Stop voice'}>
          <span className="energy-core" />
          <span className="energy-wave wave-one" />
          <span className="energy-wave wave-two" />
          <span className="energy-wave wave-three" />
        </button>
        <div className="vs">{label}</div>
        <div className="vt">{text}</div>
        {error && <div className="warnbox voice-error">{error}</div>}
      </div>
      <div className="voice-bottom">
        <button className="voice-main-control compact" onClick={toggle}>{phase === 'idle' ? 'Start' : 'End'}</button>
      </div>
    </div>
  );
}

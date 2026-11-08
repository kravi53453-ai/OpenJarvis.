import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { memory, MEMORY_LIMIT_BYTES } from '../lib/memory';
import Frame from './Frame';

export default function MemoryScreen({ onBack }: { onBack: () => void }) {
  const [, force] = useState(0); const [text, setText] = useState(''); const re = () => force(n => n + 1);
  const used = memory.usedBytes(); const notes = [...memory.all()].reverse();
  return (
    <Frame title="Memory" onBack={onBack}>
      <div className="card"><h3>Saved notes</h3>
        <p>Short facts OpenJarvis (or you) saved. They are kept in this app’s local storage only, and the latest ones are included with your messages so the assistant can use them — in Cloud Mode that means they are sent to your chosen provider.</p>
        <div className="bar"><i style={{ width: `${Math.min(100, used / MEMORY_LIMIT_BYTES * 100)}%` }} /></div>
        <div className="note">{(used / 1024).toFixed(1)} KB of {MEMORY_LIMIT_BYTES / 1024} KB used. Oldest notes are removed automatically when full (browser storage allows roughly 5 MB in total).</div>
        <div className="row"><input className="field" style={{ flex: 1 }} placeholder="Add a note…" value={text} onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value)} /><button className="btn primary sm" disabled={!text.trim()} onClick={() => { memory.add(text, 'user'); setText(''); re(); }}>Add</button></div>
      </div>
      {!notes.length && <div className="note">Nothing saved yet.</div>}
      {notes.map(n => <div className="card" key={n.id}><div>{n.text}</div><div className="row sp"><span className="note">{new Date(n.ts).toLocaleString()} · {n.by === 'ai' ? 'saved by assistant' : 'added by you'}</span><button className="btn sm danger" onClick={() => { memory.remove(n.id); re(); }}>Delete</button></div></div>)}
      {!!notes.length && <button className="btn danger" onClick={() => { if (confirm('Delete all saved notes?')) { memory.clear(); re(); } }}>Delete all notes</button>}
    </Frame>
  );
}

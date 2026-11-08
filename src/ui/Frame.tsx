import type { ReactNode } from 'react';
import { Icon } from './Icon';
export default function Frame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return <div className="scr"><header className="hdr"><button className="iconbtn" onClick={onBack} aria-label="Back"><Icon name="back" /></button><h1>{title}</h1></header><div className="body">{children}</div></div>;
}
export function Badge({ kind, children }: { kind?: 'ok' | 'err' | 'warn'; children: ReactNode }) { return <span className={`badge ${kind || ''}`}>{children}</span>; }

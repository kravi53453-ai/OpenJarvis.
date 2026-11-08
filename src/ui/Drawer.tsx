import type { ChangeEvent } from 'react';
import type { PersonaId, ProviderCard, Status } from '../lib/types';
import { PROFILE_NAME } from '../lib/types';
import { Icon } from './Icon';

export type Screen = 'chat' | 'providers' | 'offline' | 'permissions' | 'memory' | 'settings';
interface Props {
  status: Status | null; providers: ProviderCard[]; persona: PersonaId; screen: Screen; busy: boolean;
  onClose: () => void; onGo: (s: Screen) => void; onPersona: (p: PersonaId) => void; onMode: (m: 'cloud' | 'offline') => void; onProvider: (id: string) => void; onNew: () => void;
}
export default function Drawer(p: Props) {
  const nav = (s: Screen, icon: string, label: string) => <button className={`nav${p.screen === s ? ' on' : ''}`} onClick={() => { p.onGo(s); p.onClose(); }}><Icon name={icon} />{label}</button>;
  const mode = p.status?.mode ?? 'cloud';
  return (<>
    <div className="scrim" onClick={p.onClose} />
    <aside className="drawer" aria-label="Menu">
      <div className="me"><img src="/assets/jarvis_logo.webp" alt="OpenJarvis" /><div><b>{PROFILE_NAME}</b><small>OpenJarvis</small></div></div>
      <button className="nav" onClick={() => { p.onNew(); p.onClose(); }}><Icon name="plus" />New chat</button>
      <div className="sec">Assistant</div>
      <div className="pers">
        {(['KAJAL', 'ADAM'] as PersonaId[]).map(id => <button key={id} className={p.persona === id ? 'on' : ''} onClick={() => p.onPersona(id)}><img src={id === 'ADAM' ? '/assets/ui_adam.webp' : '/assets/ui_kajal.webp'} alt="" /><span>{id === 'ADAM' ? 'Adam' : 'Kajal'}</span></button>)}
      </div>
      <div className="sec">Mode (never switches by itself)</div>
      <div className="seg"><button className={mode === 'cloud' ? 'on' : ''} disabled={p.busy} onClick={() => p.onMode('cloud')}>Cloud</button><button className={mode === 'offline' ? 'on' : ''} disabled={p.busy} onClick={() => p.onMode('offline')}>Offline</button></div>
      {mode === 'cloud' && <select className="field" value={p.status?.provider || ''} onChange={(e: ChangeEvent<HTMLSelectElement>) => p.onProvider(e.target.value)} aria-label="Cloud provider">
        {p.providers.filter(c => c.isChat).map(c => <option key={c.id} value={c.id}>{c.label}{c.configured ? '' : ' (no key)'}</option>)}
      </select>}
      <div className="note" style={{ padding: '0 4px' }}>{mode === 'cloud' ? 'Messages are sent to the selected cloud provider.' : 'Messages stay on this device (local model server).'}</div>
      <div className="sec">Settings</div>
      {nav('providers', 'key', 'Providers & API keys')}
      {nav('offline', 'chip', 'Offline mode & models')}
      {nav('permissions', 'shield', 'Android permissions')}
      {nav('memory', 'brain', 'Memory')}
      {nav('settings', 'gear', 'Appearance & about')}
    </aside>
  </>);
}

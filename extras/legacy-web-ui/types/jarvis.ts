export type PersonaId = 'KAJAL' | 'ADAM';

export interface PersonaInfo {
  id: PersonaId; title: string; layer: number; bg: string; voice: string; subtitle: string; tagline: string; accentColor: string;
}

export const PERSONAS: Record<PersonaId, PersonaInfo> = {
  KAJAL: { id: 'KAJAL', title: 'Kajal', layer: 1, bg: '/assets/ui_kajal.webp', voice: 'Kore', subtitle: 'Warm Voice Companion & Assistant', tagline: 'Your Voice, My World', accentColor: '#22D3FF' },
  ADAM: { id: 'ADAM', title: 'Adam', layer: 2, bg: '/assets/ui_adam.webp', voice: 'Puck', subtitle: 'Male Voice Companion & Assistant', tagline: 'Think • Talk • Act', accentColor: '#38BDF8' },
};

export interface ChatMessage { id: string; role: 'user' | 'model' | 'system'; text: string; timestamp: string; imageData?: string; toolCalls?: { name: string; args: any; result?: string }[]; }
export interface MemoryRecord { id: string; timestamp: string; who: 'USER' | 'JARVIS' | 'NOTE'; text: string; }
export interface AccessibilityAction { id: string; type: 'open_app' | 'read_screen' | 'tap' | 'type_text' | 'scroll' | 'press' | 'remember' | 'recall'; params: any; result: string; timestamp: string; }
export type ScreenId = 'home' | 'perm' | 'api' | 'memory' | 'dual_mode';

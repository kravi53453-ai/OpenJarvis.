import { MemoryRecord } from '../types/jarvis';

const STORAGE_KEY = 'openjarvis_memory_v1';
export const MAX_MEMORY_BYTES = 1024 * 1024 * 1024; // 1 GB

class MemoryService {
  private records: MemoryRecord[] = [];

  constructor() {
    this.load();
    if (this.records.length === 0) {
      // Seed initial helpful memories as if Jarvis had previous interactions
      this.add('NOTE', 'User prefers conversational replies in Hindi / Hinglish and English.');
      this.add('NOTE', 'OpenJarvis accessibility controller is armed and ready.');
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.records = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load memory from localStorage', e);
      this.records = [];
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) {
      console.warn('Memory storage full, pruning oldest 50%', e);
      this.records = this.records.slice(Math.floor(this.records.length / 2));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
      } catch (err) {
        console.error('Cannot save memory', err);
      }
    }
  }

  public add(who: 'USER' | 'JARVIS' | 'NOTE', text: string): void {
    if (!text || !text.trim()) return;
    const now = new Date();
    const ts = now.toISOString().replace('T', ' ').slice(0, 16);
    const rec: MemoryRecord = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      timestamp: ts,
      who,
      text: text.trim().replace(/\n/g, ' '),
    };
    this.records.push(rec);

    // Check size limit (1GB buffer)
    const currentSize = this.getSizeInBytes();
    if (currentSize > MAX_MEMORY_BYTES) {
      this.records = this.records.slice(Math.floor(this.records.length / 2));
    }
    this.save();
  }

  public search(query: string): string {
    if (!query || !query.trim()) return '';
    const q = query.toLowerCase().trim();
    const matches = this.records.filter((r) => r.text.toLowerCase().includes(q));
    return matches
      .slice(-20)
      .map((m) => `${m.timestamp} ${m.who}: ${m.text}`)
      .join('\n');
  }

  public tail(chars: number = 4000): string {
    const formatted = this.records
      .map((r) => `${r.timestamp} ${r.who}: ${r.text}`)
      .join('\n');
    if (formatted.length <= chars) return formatted;
    return formatted.slice(formatted.length - chars);
  }

  public getAll(): MemoryRecord[] {
    return [...this.records];
  }

  public getSizeInBytes(): number {
    const formatted = this.records
      .map((r) => `${r.timestamp} ${r.who}: ${r.text}\n`)
      .join('');
    return new Blob([formatted]).size;
  }

  public clear(): void {
    this.records = [];
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const memoryService = new MemoryService();

export type PersonaId = 'KAJAL' | 'ADAM';
export type KeyStatus = 'connected' | 'invalid_key' | 'not_configured' | 'error' | 'untested';
export interface ToolCall { id: string; name: string; args: Record<string, unknown>; raw?: unknown }
export interface ToolResult { id: string; name: string; result: string; ok: boolean }
export interface Msg {
  id: string; role: 'user' | 'assistant' | 'tool'; text: string; ts: number;
  image?: string; toolCalls?: ToolCall[]; toolResults?: ToolResult[]; error?: boolean;
}
export interface Status { mode: 'cloud' | 'offline'; provider: string; label?: string; model: string; status: KeyStatus; message: string; user: string }
export interface ProviderCard { id: string; label: string; keyHelp: string; isChat: boolean; model: string; defaultModel: string; configured: boolean; source: 'app' | 'env' | null; masked: string; status: KeyStatus; message: string; testedAt: number | null }
export interface Settings {
  mode: 'cloud' | 'offline'; provider: string;
  tts: { provider: 'device' | 'gemini' | 'elevenlabs'; geminiModel: string; elevenModel: string; geminiVoices: { KAJAL: string; ADAM: string }; elevenVoices: { KAJAL: string; ADAM: string } };
  offline: { baseUrl: string; model: string; tools: boolean; vision: boolean; contextSize: number };
}
export const PROFILE_NAME = 'Ravi';

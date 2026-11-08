export type ProviderId = 'gemini' | 'openai' | 'openrouter' | 'deepseek' | 'nvidia' | 'anthropic' | 'elevenlabs';
export type ChatProviderId = Exclude<ProviderId, 'elevenlabs'>;
export type KeyStatus = 'connected' | 'invalid_key' | 'not_configured' | 'error' | 'untested';
export type PersonaId = 'KAJAL' | 'ADAM';

export interface ToolCall { id: string; name: string; args: Record<string, unknown>; raw?: unknown }
export interface ToolResult { id: string; name: string; result: string }
export interface WireMsg {
  role: 'user' | 'assistant' | 'tool';
  text?: string;
  image?: string; // data URL (already downscaled by the client)
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}
export interface ChatReply { text: string; toolCalls: ToolCall[] }

export interface ToolDef {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, { type: string; description: string; enum?: string[] }>; required?: string[] };
}

export class ProviderError extends Error {
  constructor(public code: 'not_configured' | 'invalid_key' | 'rate_limited' | 'network' | 'provider_error' | 'bad_request' | 'unsupported', message: string, public status = 502) {
    super(message);
  }
}

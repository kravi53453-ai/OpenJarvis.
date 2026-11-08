import type { ToolDef } from './types.js';

const S = (description: string, enumv?: string[]) => ({ type: 'string', description, ...(enumv ? { enum: enumv } : {}) });
const N = (description: string) => ({ type: 'number', description });

/** Tools that run in the browser (memory) — always available. */
export const CORE_TOOLS: ToolDef[] = [
  { name: 'remember', description: 'Save a short fact about the user to local memory.', parameters: { type: 'object', properties: { note: S('The fact to remember') }, required: ['note'] } },
  { name: 'recall', description: 'Search local memory for saved facts.', parameters: { type: 'object', properties: { query: S('Search words') }, required: ['query'] } },
];

/** Tools that run in the native Android app (real AccessibilityService, camera, calls...). */
export const NATIVE_TOOLS: ToolDef[] = [
  { name: 'open_app', description: 'Launch an installed app by its visible name.', parameters: { type: 'object', properties: { app_name: S('App name, e.g. WhatsApp') }, required: ['app_name'] } },
  { name: 'read_screen', description: 'Read the visible UI of the current app (text, buttons, coordinates). Call before tap/type. Password fields are hidden.', parameters: { type: 'object', properties: {} } },
  { name: 'tap', description: 'Tap an element by visible text/description, or by x,y pixel coordinates from read_screen.', parameters: { type: 'object', properties: { text: S('Visible text or content description'), x: N('X pixel'), y: N('Y pixel') } } },
  { name: 'long_press', description: 'Long press an element by text or x,y.', parameters: { type: 'object', properties: { text: S('Visible text'), x: N('X pixel'), y: N('Y pixel') } } },
  { name: 'swipe', description: 'Swipe between two points.', parameters: { type: 'object', properties: { x1: N('Start X'), y1: N('Start Y'), x2: N('End X'), y2: N('End Y'), duration_ms: N('Duration, default 300') }, required: ['x1', 'y1', 'x2', 'y2'] } },
  { name: 'scroll', description: 'Scroll the current screen.', parameters: { type: 'object', properties: { direction: S('Direction', ['up', 'down']) }, required: ['direction'] } },
  { name: 'type_text', description: 'Type text into the focused (or first) editable field.', parameters: { type: 'object', properties: { text: S('Text to enter') }, required: ['text'] } },
  { name: 'press', description: 'Press a system button.', parameters: { type: 'object', properties: { button: S('Button', ['back', 'home', 'recents', 'notifications']) }, required: ['button'] } },
  { name: 'find_contact', description: 'Search the user\'s contacts by name (needs Contacts permission).', parameters: { type: 'object', properties: { query: S('Name to search') }, required: ['query'] } },
  { name: 'call_phone', description: 'Start a phone call. Android shows a confirmation dialog to the user with the name and number; nothing is dialed unless the user confirms.', parameters: { type: 'object', properties: { number: S('Phone number'), name: S('Contact name if known') }, required: ['number'] } },
  { name: 'open_camera', description: 'Open the real camera screen with a live preview. auto_capture starts a visible 3-second countdown.', parameters: { type: 'object', properties: { mode: S('photo or video', ['photo', 'video']), lens: S('front or rear', ['front', 'rear']), auto_capture: S('true to capture after countdown', ['true', 'false']) } } },
  { name: 'take_screenshot', description: 'Capture the screen (Android shows its own screen-capture consent each session).', parameters: { type: 'object', properties: {} } },
  { name: 'get_location', description: 'Get the last known location (needs Location permission).', parameters: { type: 'object', properties: {} } },
  { name: 'show_notification', description: 'Show a notification from OpenJarvis.', parameters: { type: 'object', properties: { title: S('Title'), text: S('Body') }, required: ['title', 'text'] } },
  { name: 'read_clipboard', description: 'Read the clipboard (Android only allows this while OpenJarvis is in the foreground).', parameters: { type: 'object', properties: {} } },
  { name: 'set_clipboard', description: 'Copy text to the clipboard.', parameters: { type: 'object', properties: { text: S('Text') }, required: ['text'] } },
  { name: 'share_text', description: 'Open the Android share sheet with some text.', parameters: { type: 'object', properties: { text: S('Text to share') }, required: ['text'] } },
  { name: 'open_url', description: 'Open an http/https link in the browser.', parameters: { type: 'object', properties: { url: S('URL') }, required: ['url'] } },
  { name: 'pick_file', description: 'Ask the user to pick a file; returns name, size and (for small text files) content.', parameters: { type: 'object', properties: {} } },
  { name: 'bluetooth_status', description: 'Report Bluetooth on/off and paired device names (needs Nearby devices permission).', parameters: { type: 'object', properties: {} } },
];

export function toolsFor(native: boolean): ToolDef[] { return native ? [...CORE_TOOLS, ...NATIVE_TOOLS] : CORE_TOOLS; }

export function buildSystemPrompt(persona: 'KAJAL' | 'ADAM', native: boolean, memory: string, userName = 'Ravi'): string {
  const who = persona === 'KAJAL' ? 'Kajal, a warm and sharp female assistant' : 'Adam, a calm and capable male assistant';
  return [
    `You are ${who} inside the OpenJarvis app. The user's name is ${userName}.`,
    'Reply in the language the user uses (Hindi, English or Hinglish). Keep replies short and conversational; they may be spoken aloud, so avoid markdown tables and long lists.',
    native
      ? 'You run inside the native Android app and can use the provided tools to act on the real phone. Use read_screen before tapping or typing. Work step by step, stop and tell the user when a step fails, and never claim an action succeeded unless the tool result says so. Ask the user before anything involving money, passwords, deleting data or sending messages. Calls always need the user\'s on-screen confirmation.'
      : 'This session runs in a web browser: you have NO access to the phone, screen, camera or contacts. Never claim to have performed phone actions; say what the user can do instead.',
    'Only "remember" and "recall" touch local memory. Never invent tool results.',
    memory ? `Saved memory about the user:\n${memory.slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n\n');
}

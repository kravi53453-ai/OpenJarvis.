import { AccessibilityAction } from '../types/jarvis';
import { memoryService } from './memory';

export type AppId =
  | 'home'
  | 'camera'
  | 'notes'
  | 'whatsapp'
  | 'youtube'
  | 'maps'
  | 'settings'
  | 'calculator'
  | 'gallery'
  | 'browser';

export interface VirtualAppState {
  currentApp: AppId;
  previousApp: AppId;
  screenTitle: string;
  focusedInputId: string | null;
  focusedInputText: string;
  actionHighlight: {
    type: 'tap' | 'type' | 'scroll' | 'open' | 'press';
    text?: string;
    timestamp: number;
  } | null;
  notifications: string[];
  notes: { id: string; title: string; content: string; date: string }[];
  whatsappChats: {
    id: string;
    sender: string;
    lastMessage: string;
    messages: { fromMe: boolean; text: string; time: string }[];
  }[];
  youtubeSearch: string;
  youtubeVideos: { id: string; title: string; channel: string; views: string; duration: string }[];
  calculatorDisplay: string;
  browserUrl: string;
  logs: AccessibilityAction[];
}

class VirtualDeviceService {
  private listeners: ((state: VirtualAppState) => void)[] = [];

  private state: VirtualAppState = {
    currentApp: 'home',
    previousApp: 'home',
    screenTitle: 'Home Screen',
    focusedInputId: null,
    focusedInputText: '',
    actionHighlight: null,
    notifications: [
      'OpenJarvis Accessibility Service Active',
      'Google Play Protect: Device Secure',
      'New message from Tony Stark: "Jarvis v2 update deployed!"',
    ],
    notes: [
      { id: '1', title: 'Jarvis Setup', content: 'Accessibility permission granted. Gemini 3.8 Flash live connection established.', date: 'Today, 10:15 AM' },
      { id: '2', title: 'Shopping List', content: '1. Coffee beans\n2. USB-C Cable\n3. Wireless earbuds', date: 'Yesterday' },
    ],
    whatsappChats: [
      {
        id: '1',
        sender: 'Tony Stark',
        lastMessage: 'Check the new telemetry diagnostics',
        messages: [
          { fromMe: false, text: 'Hey, are the Jarvis audio drivers active?', time: '11:20 AM' },
          { fromMe: true, text: 'Yes, running on port 3000!', time: '11:21 AM' },
          { fromMe: false, text: 'Awesome! Send me the benchmark log.', time: '11:23 AM' },
        ],
      },
      {
        id: '2',
        sender: 'Vikram',
        lastMessage: 'Meeting at 4 PM?',
        messages: [
          { fromMe: false, text: 'Are we still on for the design review at 4?', time: '09:40 AM' },
        ],
      },
    ],
    youtubeSearch: '',
    youtubeVideos: [
      { id: '1', title: 'OpenJarvis: Building Autonomous Phone Agents with Gemini', channel: 'AI Engineering Hub', views: '240K views', duration: '14:22' },
      { id: '2', title: 'Iron Man HUD & Neural OS Interface Design', channel: 'Future Tech', views: '1.2M views', duration: '08:45' },
      { id: '3', title: 'Chill Lo-Fi Beats to Code & Build Apps To [24/7]', channel: 'Lofi Girl', views: '32M views', duration: 'LIVE' },
      { id: '4', title: 'Android Accessibility Service Deep Dive: How Screen Automation Works', channel: 'DevMaster', views: '95K views', duration: '21:10' },
    ],
    calculatorDisplay: '0',
    browserUrl: 'https://google.com',
    logs: [],
  };

  public subscribe(fn: (state: VirtualAppState) => void) {
    this.listeners.push(fn);
    fn(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state));
  }

  public getState(): VirtualAppState {
    return this.state;
  }

  public logAction(
    type: AccessibilityAction['type'],
    params: any,
    result: string
  ) {
    const action: AccessibilityAction = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      params,
      result,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    this.state.logs = [action, ...this.state.logs.slice(0, 49)];
    this.notify();
  }

  public setHighlight(type: 'tap' | 'type' | 'scroll' | 'open' | 'press', text?: string) {
    this.state.actionHighlight = { type, text, timestamp: Date.now() };
    this.notify();
    setTimeout(() => {
      if (this.state.actionHighlight?.text === text) {
        this.state.actionHighlight = null;
        this.notify();
      }
    }, 2500);
  }

  // --- Accessibility Controller implementation matching Core.kt ---

  public openApp(appName: string): string {
    const clean = (appName || '').toLowerCase().trim();
    const appMap: Record<string, AppId> = {
      camera: 'camera',
      cam: 'camera',
      photo: 'camera',
      notes: 'notes',
      note: 'notes',
      notepad: 'notes',
      memo: 'notes',
      whatsapp: 'whatsapp',
      chat: 'whatsapp',
      message: 'whatsapp',
      messages: 'whatsapp',
      youtube: 'youtube',
      video: 'youtube',
      music: 'youtube',
      maps: 'maps',
      map: 'maps',
      navigation: 'maps',
      settings: 'settings',
      setting: 'settings',
      calculator: 'calculator',
      calc: 'calculator',
      gallery: 'gallery',
      photos: 'gallery',
      browser: 'browser',
      chrome: 'browser',
      web: 'browser',
      home: 'home',
    };

    const target = appMap[clean] || (Object.keys(appMap).find((k) => clean.includes(k)) ? appMap[Object.keys(appMap).find((k) => clean.includes(k))!] : null);

    if (target) {
      this.state.previousApp = this.state.currentApp;
      this.state.currentApp = target;
      this.state.screenTitle = target.toUpperCase();
      this.setHighlight('open', target);
      const res = `opened ${target}`;
      this.logAction('open_app', { app_name: appName }, res);
      return res;
    }

    const fail = `app '${appName}' not installed`;
    this.logAction('open_app', { app_name: appName }, fail);
    return fail;
  }

  public readScreen(): string {
    const { currentApp, notes, whatsappChats, youtubeVideos, calculatorDisplay, browserUrl } = this.state;
    const elements: string[] = [];

    elements.push(`[screen: ${currentApp.toUpperCase()}]`);

    switch (currentApp) {
      case 'home':
        elements.push('[status] Battery 98%, Wi-Fi Connected, 5G Full');
        elements.push('[notification] OpenJarvis Accessibility Service Active');
        elements.push('[app_icon] Camera');
        elements.push('[app_icon] Notes');
        elements.push('[app_icon] WhatsApp');
        elements.push('[app_icon] YouTube');
        elements.push('[app_icon] Maps');
        elements.push('[app_icon] Settings');
        elements.push('[app_icon] Calculator');
        elements.push('[app_icon] Gallery');
        elements.push('[app_icon] Browser');
        elements.push('[widget] Google Search Bar');
        break;

      case 'camera':
        elements.push('[viewfinder] Live Camera View (1080p 60fps)');
        elements.push('[button] Shutter Button / Take Photo');
        elements.push('[button] Switch Camera');
        elements.push('[button] Gallery Preview');
        elements.push('[button] Flash Mode (Auto)');
        break;

      case 'notes':
        elements.push('[header] My Notes (Total: ' + notes.length + ')');
        elements.push('[button] + New Note');
        notes.forEach((n) => {
          elements.push(`[note_item] Title: "${n.title}", Content: "${n.content.slice(0, 40)}"`);
        });
        elements.push('[button] Back');
        break;

      case 'whatsapp':
        elements.push('[header] WhatsApp');
        whatsappChats.forEach((c) => {
          elements.push(`[chat_contact] ${c.sender}: "${c.lastMessage}"`);
        });
        elements.push('[button] Start New Chat');
        elements.push('[input_field] Search chats');
        break;

      case 'youtube':
        elements.push('[header] YouTube');
        elements.push('[input_field] Search YouTube (' + (this.state.youtubeSearch || 'empty') + ')');
        elements.push('[button] Search');
        youtubeVideos.forEach((v) => {
          elements.push(`[video_card] "${v.title}" by ${v.channel} (${v.views}, ${v.duration})`);
        });
        break;

      case 'maps':
        elements.push('[header] Google Maps');
        elements.push('[input_field] Search location');
        elements.push('[button] Navigate / Directions');
        elements.push('[map_info] Current Location: Silicon Valley / Bangalore Hub');
        break;

      case 'settings':
        elements.push('[header] System Settings');
        elements.push('[setting_item] Accessibility: Enabled (OpenJarvis)');
        elements.push('[setting_item] Wi-Fi: HighSpeed_5G (Connected)');
        elements.push('[setting_item] Bluetooth: On');
        elements.push('[setting_item] Battery: 98% (Unrestricted)');
        elements.push('[setting_item] Storage: 45 GB free of 128 GB');
        elements.push('[setting_item] Gemini API: Configured');
        break;

      case 'calculator':
        elements.push(`[display] Current Value: ${calculatorDisplay}`);
        elements.push('[keypad] Buttons: 7, 8, 9, /, 4, 5, 6, *, 1, 2, 3, -, 0, C, =, +');
        break;

      case 'gallery':
        elements.push('[header] Photos & Gallery');
        elements.push('[album] Camera Roll (48 items)');
        elements.push('[album] Screenshots (12 items)');
        elements.push('[button] Share');
        break;

      case 'browser':
        elements.push(`[url_bar] URL: ${browserUrl}`);
        elements.push('[input_field] Search the Web or enter address');
        elements.push('[button] Go / Search');
        break;
    }

    const output = elements.join('\n');
    this.logAction('read_screen', {}, `found ${elements.length} elements on ${currentApp}`);
    this.setHighlight('tap', 'Screen Scanned');
    return output;
  }

  public tap(text: string): boolean {
    if (!text) return false;
    const clean = text.toLowerCase().trim();
    this.setHighlight('tap', text);

    // If tapping an app icon or name
    const appLaunch = this.openApp(clean);
    if (!appLaunch.includes('not installed')) {
      return true;
    }

    // Specific button handlers
    if (clean.includes('shutter') || clean.includes('take photo')) {
      this.logAction('tap', { text }, 'Photo captured and saved to Gallery');
      return true;
    }

    if (clean.includes('new note') || clean.includes('+ note') || clean.includes('create note')) {
      const id = Date.now().toString();
      this.state.notes.unshift({
        id,
        title: 'New Note',
        content: 'Tap to type your notes...',
        date: 'Just now',
      });
      this.state.focusedInputId = id;
      this.logAction('tap', { text }, 'Created new blank note');
      this.notify();
      return true;
    }

    if (clean.includes('tony stark') && this.state.currentApp === 'whatsapp') {
      this.logAction('tap', { text }, 'Opened chat with Tony Stark');
      return true;
    }

    if (clean.includes('clear') || clean === 'c') {
      if (this.state.currentApp === 'calculator') {
        this.state.calculatorDisplay = '0';
        this.notify();
      }
      this.logAction('tap', { text }, 'Cleared display');
      return true;
    }

    if (this.state.currentApp === 'calculator') {
      const key = text.trim();
      if (/^[0-9+\-*/.=]$/.test(key)) {
        if (key === '=') {
          try {
            this.state.calculatorDisplay = String(eval(this.state.calculatorDisplay));
          } catch {
            this.state.calculatorDisplay = 'Error';
          }
        } else if (this.state.calculatorDisplay === '0' && /^[0-9]$/.test(key)) {
          this.state.calculatorDisplay = key;
        } else {
          this.state.calculatorDisplay += key;
        }
        this.notify();
        this.logAction('tap', { text }, `Keypad ${key} pressed`);
        return true;
      }
    }

    // If element matched video card
    if (this.state.currentApp === 'youtube') {
      const vid = this.state.youtubeVideos.find((v) =>
        v.title.toLowerCase().includes(clean)
      );
      if (vid) {
        this.logAction('tap', { text }, `Playing video: "${vid.title}"`);
        return true;
      }
    }

    this.logAction('tap', { text }, `Tapped element: "${text}"`);
    return true;
  }

  public typeText(text: string): boolean {
    if (!text) return false;
    this.setHighlight('type', text);

    if (this.state.currentApp === 'notes') {
      if (this.state.notes.length > 0) {
        this.state.notes[0].content += (this.state.notes[0].content ? '\n' : '') + text;
        this.logAction('type_text', { text }, `Typed into Note: "${text}"`);
        this.notify();
        return true;
      }
    }

    if (this.state.currentApp === 'whatsapp') {
      if (this.state.whatsappChats[0]) {
        this.state.whatsappChats[0].messages.push({
          fromMe: true,
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        this.state.whatsappChats[0].lastMessage = text;
        this.logAction('type_text', { text }, `Sent WhatsApp message: "${text}"`);
        this.notify();
        return true;
      }
    }

    if (this.state.currentApp === 'youtube') {
      this.state.youtubeSearch = text;
      this.logAction('type_text', { text }, `Typed YouTube search query: "${text}"`);
      this.notify();
      return true;
    }

    if (this.state.currentApp === 'browser') {
      this.state.browserUrl = `https://google.com/search?q=${encodeURIComponent(text)}`;
      this.logAction('type_text', { text }, `Searched web for: "${text}"`);
      this.notify();
      return true;
    }

    this.state.focusedInputText = text;
    this.logAction('type_text', { text }, `Typed text: "${text}"`);
    this.notify();
    return true;
  }

  public scroll(direction: string): boolean {
    const dir = direction.toLowerCase().includes('up') ? 'up' : 'down';
    this.setHighlight('scroll', `Scroll ${dir}`);
    this.logAction('scroll', { direction }, `Scrolled screen ${dir}`);
    return true;
  }

  public press(button: string): string {
    const b = (button || '').toLowerCase().trim();
    this.setHighlight('press', b);

    if (b === 'home') {
      this.state.previousApp = this.state.currentApp;
      this.state.currentApp = 'home';
      this.state.screenTitle = 'Home';
      this.notify();
      this.logAction('press', { button }, 'Navigated to Home');
      return 'ok';
    }

    if (b === 'back') {
      const prev = this.state.previousApp;
      this.state.previousApp = this.state.currentApp;
      this.state.currentApp = prev;
      this.state.screenTitle = prev.toUpperCase();
      this.notify();
      this.logAction('press', { button }, 'Navigated Back');
      return 'ok';
    }

    if (b === 'recents') {
      this.logAction('press', { button }, 'Opened recent apps view');
      return 'ok';
    }

    if (b === 'notifications') {
      this.logAction('press', { button }, 'Opened notifications shade');
      return 'ok';
    }

    return 'unknown button';
  }

  public executeTool(name: string, args: any): string {
    switch (name) {
      case 'open_app':
        return this.openApp(args?.app_name || '');
      case 'read_screen':
        return this.readScreen();
      case 'tap':
        return this.tap(args?.text || '') ? 'tapped' : 'element not found';
      case 'type_text':
        return this.typeText(args?.text || '') ? 'typed' : 'no active field';
      case 'scroll':
        return this.scroll(args?.direction || 'down') ? 'scrolled' : 'cannot scroll';
      case 'press':
        return this.press(args?.button || 'home');
      case 'remember':
        memoryService.add('NOTE', args?.note || '');
        return 'saved to persistent memory';
      case 'recall':
        const found = memoryService.search(args?.query || '');
        return found || 'nothing found in memory';
      default:
        return 'unknown tool';
    }
  }
}

export const virtualDevice = new VirtualDeviceService();

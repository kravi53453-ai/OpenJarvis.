import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  FileText,
  MessageCircle,
  PlaySquare,
  MapPin,
  Settings,
  Calculator,
  Image,
  Globe,
  ArrowLeft,
  Search,
  Plus,
  Send,
  Sparkles,
  Wifi,
  BatteryCharging,
  Clock,
  RotateCcw,
  Check,
  AlertCircle,
  Eye,
  Terminal,
} from 'lucide-react';
import { virtualDevice, VirtualAppState, AppId } from '../services/virtualDevice';

interface VirtualPhoneProps {
  onCaptureSnapshot?: (base64Image: string) => void;
  onRequestJarvisHelp?: (prompt: string) => void;
}

export const VirtualPhone: React.FC<VirtualPhoneProps> = ({
  onCaptureSnapshot,
  onRequestJarvisHelp,
}) => {
  const [deviceState, setDeviceState] = useState<VirtualAppState>(virtualDevice.getState());
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string>('1');
  const [showLogs, setShowLogs] = useState(false);
  const [currentTime, setCurrentTime] = useState('10:42');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);

  useEffect(() => {
    const unsubscribe = virtualDevice.subscribe((state) => {
      setDeviceState({ ...state });
    });

    const updateClock = () => {
      const d = new Date();
      setCurrentTime(
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Handle webcam when camera app is active
  useEffect(() => {
    if (deviceState.currentApp === 'camera' && isWebcamActive) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn('Webcam permission not granted:', err);
          setIsWebcamActive(false);
        });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [deviceState.currentApp, isWebcamActive]);

  const capturePhoto = () => {
    if (isWebcamActive && videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        onCaptureSnapshot?.(dataUrl);
        virtualDevice.logAction('tap', { text: 'Shutter Button' }, 'Captured webcam frame');
        return;
      }
    }

    // Simulated camera capture
    const simulatedPhoto = '/assets/ui_kajal.webp';
    onCaptureSnapshot?.(simulatedPhoto);
    virtualDevice.logAction('tap', { text: 'Shutter Button' }, 'Captured photo from camera lens');
  };

  const handleCreateNote = () => {
    if (!newNoteTitle.trim()) return;
    virtualDevice.getState().notes.unshift({
      id: Date.now().toString(),
      title: newNoteTitle.trim(),
      content: newNoteContent.trim() || 'No additional content',
      date: 'Just now',
    });
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsCreatingNote(false);
    virtualDevice.logAction('tap', { text: 'Save Note' }, 'Added new note item');
    virtualDevice.openApp('notes');
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    const chat = deviceState.whatsappChats.find((c) => c.id === selectedChatId);
    if (chat) {
      chat.messages.push({
        fromMe: true,
        text: chatInput.trim(),
        time: currentTime,
      });
      chat.lastMessage = chatInput.trim();
      setChatInput('');
      virtualDevice.logAction('type_text', { text: chatInput }, `Sent message to ${chat.sender}`);
      virtualDevice.openApp('whatsapp');
    }
  };

  return (
    <div className="relative flex flex-col items-center w-full max-w-md mx-auto">
      {/* Device Frame */}
      <div className="relative w-full aspect-[9/19] bg-[#020617] rounded-[42px] p-3.5 border-4 border-[#1E293B] shadow-[0_0_50px_rgba(30,91,255,0.25)] flex flex-col overflow-hidden">
        {/* Dynamic Island / Camera Notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 flex items-center justify-between px-3 border border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F172A] border border-cyan-500/40 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-cyan-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[9px] text-[#22D3FF] font-mono">JARVIS</span>
          </div>
        </div>

        {/* Screen Bezel inner container */}
        <div className="relative w-full h-full bg-[#070D1E] rounded-[32px] overflow-hidden flex flex-col border border-white/5">
          {/* Status Bar */}
          <div className="h-10 pt-1.5 px-6 flex items-center justify-between text-xs text-white/80 z-30 select-none">
            <div className="font-semibold tracking-wider text-xs">{currentTime}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-300 font-medium">5G</span>
              <Wifi className="w-3.5 h-3.5" />
              <div className="flex items-center gap-0.5">
                <span className="text-[10px]">98%</span>
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Action Glow / Touch indicator when Jarvis taps */}
          {deviceState.actionHighlight && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-4 border-[#22D3FF] bg-[#22D3FF]/20 animate-ping flex items-center justify-center shadow-[0_0_30px_#22D3FF]" />
              <div className="mt-2 px-3 py-1 bg-black/80 backdrop-blur-md rounded-full border border-[#22D3FF] text-[11px] text-[#22D3FF] font-bold flex items-center gap-1.5 shadow-lg">
                <Sparkles className="w-3 h-3 text-[#22D3FF]" />
                <span>Jarvis: {deviceState.actionHighlight.type.toUpperCase()} "{deviceState.actionHighlight.text || ''}"</span>
              </div>
            </div>
          )}

          {/* App Screen Content */}
          <div className="flex-1 overflow-y-auto relative text-white">
            {/* 1. HOME SCREEN */}
            {deviceState.currentApp === 'home' && (
              <div className="p-4 flex flex-col h-full justify-between">
                {/* Search Widget */}
                <div>
                  <div
                    onClick={() => virtualDevice.openApp('browser')}
                    className="w-full bg-[#0A1A3A]/90 backdrop-blur-md border border-[#1E5BFF]/30 rounded-full px-4 py-3 flex items-center justify-between text-xs text-slate-300 cursor-pointer shadow-lg hover:border-[#22D3FF] transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Search className="w-4 h-4 text-[#22D3FF]" />
                      <span>Search apps, web, or ask Jarvis…</span>
                    </div>
                    <img
                      src="/assets/jarvis_logo.webp"
                      alt="Jarvis"
                      className="w-5 h-5 rounded-full"
                    />
                  </div>

                  {/* Notification banner */}
                  <div
                    onClick={() => virtualDevice.openApp('settings')}
                    className="mt-4 p-3 bg-gradient-to-r from-[#0F2755]/80 to-[#0A1A3A]/80 border border-[#22D3FF]/30 rounded-2xl flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#22D3FF]/20 flex items-center justify-center border border-[#22D3FF]/40">
                        <Sparkles className="w-4 h-4 text-[#22D3FF]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Accessibility Controller</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Auto-read screen, tap, scroll & remember
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* App Grid */}
                <div className="grid grid-cols-4 gap-y-5 gap-x-3 my-auto py-4">
                  {[
                    { id: 'camera', name: 'Camera', icon: Camera, color: 'from-amber-500 to-orange-600' },
                    { id: 'notes', name: 'Notes', icon: FileText, color: 'from-blue-500 to-indigo-600' },
                    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'from-emerald-500 to-green-600' },
                    { id: 'youtube', name: 'YouTube', icon: PlaySquare, color: 'from-red-500 to-rose-600' },
                    { id: 'maps', name: 'Maps', icon: MapPin, color: 'from-teal-500 to-cyan-600' },
                    { id: 'settings', name: 'Settings', icon: Settings, color: 'from-slate-600 to-slate-800' },
                    { id: 'calculator', name: 'Calculator', icon: Calculator, color: 'from-violet-500 to-purple-600' },
                    { id: 'browser', name: 'Browser', icon: Globe, color: 'from-cyan-500 to-blue-600' },
                  ].map((app) => (
                    <button
                      key={app.id}
                      onClick={() => virtualDevice.openApp(app.id)}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div
                        className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform border border-white/20`}
                      >
                        <app.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-200">
                        {app.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Bottom Dock */}
                <div className="p-3 bg-[#0A1A3A]/70 backdrop-blur-md rounded-3xl border border-white/10 flex items-center justify-around">
                  {[
                    { id: 'camera', icon: Camera },
                    { id: 'whatsapp', icon: MessageCircle },
                    { id: 'notes', icon: FileText },
                    { id: 'browser', icon: Globe },
                  ].map((dockApp) => (
                    <button
                      key={dockApp.id}
                      onClick={() => virtualDevice.openApp(dockApp.id)}
                      className="p-2.5 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <dockApp.icon className="w-5 h-5 text-slate-200" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. CAMERA APP */}
            {deviceState.currentApp === 'camera' && (
              <div className="flex flex-col h-full bg-black relative">
                {/* Camera Viewfinder */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                  {isWebcamActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <img
                        src="/assets/ui_adam.webp"
                        alt="Camera Viewfinder Scene"
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs text-white">
                        <span className="bg-black/60 px-2.5 py-1 rounded-full border border-white/10">
                          4K UHD · 60 FPS
                        </span>
                        <button
                          onClick={() => setIsWebcamActive(!isWebcamActive)}
                          className="bg-[#22D3FF]/20 text-[#22D3FF] px-2.5 py-1 rounded-full border border-[#22D3FF]/40 text-xs font-semibold"
                        >
                          Enable Webcam
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Grid Lines */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/10">
                    <div className="border border-white/10" />
                    <div className="border border-white/10" />
                    <div className="border border-white/10" />
                    <div className="border border-white/10" />
                    <div className="border border-white/10" />
                    <div className="border border-white/10" />
                  </div>
                </div>

                {/* Shutter Bar */}
                <div className="h-28 bg-black/90 p-4 flex items-center justify-around border-t border-white/10">
                  <button
                    onClick={() => virtualDevice.openApp('gallery')}
                    className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/20 bg-slate-800"
                  >
                    <img
                      src="/assets/ui_kajal.webp"
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <button
                    onClick={capturePhoto}
                    className="w-18 h-18 rounded-full border-4 border-white p-1 flex items-center justify-center hover:scale-95 transition-transform"
                  >
                    <div className="w-full h-full rounded-full bg-white active:bg-cyan-400" />
                  </button>

                  <button
                    onClick={() => setIsWebcamActive(!isWebcamActive)}
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* 3. NOTES APP */}
            {deviceState.currentApp === 'notes' && (
              <div className="flex flex-col h-full bg-[#07122B] p-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1E5BFF]/20">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => virtualDevice.press('home')}
                      className="p-1 rounded-full hover:bg-white/10 text-slate-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-base font-bold text-white">Notes</h3>
                  </div>
                  <button
                    onClick={() => setIsCreatingNote(true)}
                    className="px-3 py-1.5 bg-[#22D3FF] text-[#020817] rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-cyan-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New</span>
                  </button>
                </div>

                {/* Create Note modal */}
                {isCreatingNote ? (
                  <div className="mt-3 p-3 bg-[#0A1A3A] rounded-2xl border border-[#22D3FF]/30 space-y-2">
                    <input
                      type="text"
                      placeholder="Note Title"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22D3FF]"
                    />
                    <textarea
                      placeholder="Write your note..."
                      rows={3}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22D3FF]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsCreatingNote(false)}
                        className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateNote}
                        className="px-3 py-1 bg-[#22D3FF] text-black font-semibold rounded-lg text-xs"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 mt-3">
                  {deviceState.notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3.5 bg-[#0A1A3A]/80 border border-[#1E5BFF]/30 rounded-2xl hover:border-[#22D3FF]/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-white">{note.title}</h4>
                        <span className="text-[10px] text-slate-400">{note.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. WHATSAPP APP */}
            {deviceState.currentApp === 'whatsapp' && (
              <div className="flex flex-col h-full bg-[#051120]">
                {/* WhatsApp Header */}
                <div className="p-3.5 bg-[#0A1A3A] border-b border-[#1E5BFF]/30 flex items-center gap-3">
                  <button
                    onClick={() => virtualDevice.press('home')}
                    className="text-slate-300"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <img
                    src="/assets/jarvis_logo.webp"
                    alt="Contact"
                    className="w-8 h-8 rounded-full border border-cyan-400"
                  />
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-white">Tony Stark</h4>
                    <p className="text-[10px] text-emerald-400">Online · Jarvis Link Active</p>
                  </div>
                </div>

                {/* Messages list */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                  {deviceState.whatsappChats[0]?.messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[80%] ${
                        m.fromMe ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-2xl text-xs leading-relaxed ${
                          m.fromMe
                            ? 'bg-[#1E5BFF] text-white rounded-tr-none'
                            : 'bg-[#0A1A3A] text-slate-200 border border-[#1E5BFF]/30 rounded-tl-none'
                        }`}
                      >
                        {m.text}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 px-1">{m.time}</span>
                    </div>
                  ))}
                </div>

                {/* Chat input */}
                <div className="p-2.5 bg-[#0A1A3A] border-t border-[#1E5BFF]/30 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Type a message…"
                    className="flex-1 bg-black/40 border border-white/10 rounded-full px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#22D3FF]"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    className="p-2 rounded-full bg-[#22D3FF] text-black hover:bg-cyan-300 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 5. YOUTUBE APP */}
            {deviceState.currentApp === 'youtube' && (
              <div className="flex flex-col h-full bg-[#040814]">
                <div className="p-3 bg-[#0A1A3A] border-b border-[#1E5BFF]/30 flex items-center gap-2">
                  <button onClick={() => virtualDevice.press('home')} className="text-slate-300">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-500">
                    <PlaySquare className="w-4 h-4" />
                    <span>YouTube</span>
                  </div>
                  <div className="flex-1 ml-2">
                    <input
                      type="text"
                      value={deviceState.youtubeSearch}
                      onChange={(e) => {
                        virtualDevice.getState().youtubeSearch = e.target.value;
                        setDeviceState({ ...virtualDevice.getState() });
                      }}
                      placeholder="Search YouTube..."
                      className="w-full bg-black/40 border border-white/10 rounded-full px-3 py-1.5 text-[11px] text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {deviceState.youtubeVideos.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => virtualDevice.tap(video.title)}
                      className="group cursor-pointer bg-[#0A1A3A]/60 rounded-2xl overflow-hidden border border-white/5 hover:border-[#22D3FF]/50 transition-all"
                    >
                      <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
                        <img
                          src={video.id === '1' ? '/assets/jarvis_logo.webp' : video.id === '2' ? '/assets/ui_adam.webp' : '/assets/ui_kajal.webp'}
                          alt={video.title}
                          className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                            <PlaySquare className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <span className="absolute bottom-2 right-2 bg-black/80 text-[10px] px-1.5 py-0.5 rounded text-white font-mono">
                          {video.duration}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <h4 className="text-xs font-bold text-white line-clamp-1">{video.title}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {video.channel} · {video.views}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. SETTINGS APP */}
            {deviceState.currentApp === 'settings' && (
              <div className="flex flex-col h-full bg-[#050C1F] p-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[#1E5BFF]/30">
                  <button onClick={() => virtualDevice.press('home')} className="text-slate-300">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-base font-bold text-white">System Settings</h3>
                </div>

                <div className="space-y-2.5 mt-3 flex-1 overflow-y-auto">
                  <div className="p-3 bg-[#0A1A3A] rounded-2xl border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Accessibility Service</div>
                      <div className="text-[10px] text-slate-400">OpenJarvis Phone Automation Engine</div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[11px] font-bold rounded-full">
                      Active
                    </span>
                  </div>

                  <div className="p-3 bg-[#0A1A3A] rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Gemini 3.8 Intelligence</div>
                      <div className="text-[10px] text-slate-400">Model: gemini-3.8-flash + TTS</div>
                    </div>
                    <span className="px-2.5 py-1 bg-[#22D3FF]/20 text-[#22D3FF] text-[11px] font-bold rounded-full">
                      Ready
                    </span>
                  </div>

                  <div className="p-3 bg-[#0A1A3A] rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Battery Optimization</div>
                      <div className="text-[10px] text-slate-400">Unrestricted Background Execution</div>
                    </div>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>

                  <div className="p-3 bg-[#0A1A3A] rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Device Storage</div>
                      <div className="text-[10px] text-slate-400">45 GB free of 128 GB</div>
                    </div>
                    <span className="text-[11px] text-slate-400">35% used</span>
                  </div>
                </div>
              </div>
            )}

            {/* 7. CALCULATOR APP */}
            {deviceState.currentApp === 'calculator' && (
              <div className="flex flex-col h-full bg-[#020617] p-4 justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => virtualDevice.press('home')} className="text-slate-300">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-300">Calculator</span>
                </div>

                <div className="text-right py-6 px-2">
                  <div className="text-3xl font-mono font-bold text-white tracking-wider">
                    {deviceState.calculatorDisplay}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['C', '/', '*', '-', '7', '8', '9', '+', '4', '5', '6', '=', '1', '2', '3', '0'].map((btn) => (
                    <button
                      key={btn}
                      onClick={() => virtualDevice.tap(btn)}
                      className={`h-12 rounded-2xl font-mono text-sm font-bold flex items-center justify-center transition-all active:scale-95 ${
                        btn === '='
                          ? 'bg-[#22D3FF] text-black shadow-[0_0_15px_rgba(34,211,255,0.4)]'
                          : ['C', '/', '*', '-', '+'].includes(btn)
                          ? 'bg-[#1E5BFF]/30 text-[#22D3FF] border border-[#1E5BFF]/50'
                          : 'bg-[#0A1A3A] text-white hover:bg-white/10'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 8. BROWSER APP */}
            {deviceState.currentApp === 'browser' && (
              <div className="flex flex-col h-full bg-[#050C1F]">
                <div className="p-3 bg-[#0A1A3A] border-b border-[#1E5BFF]/30 flex items-center gap-2">
                  <button onClick={() => virtualDevice.press('home')} className="text-slate-300">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 text-[11px] text-[#22D3FF] font-mono truncate">
                    {deviceState.browserUrl}
                  </div>
                </div>
                <div className="flex-1 p-4 flex flex-col items-center justify-center text-center">
                  <Globe className="w-12 h-12 text-[#22D3FF] mb-3 opacity-60 animate-pulse" />
                  <h4 className="text-sm font-bold text-white">Autonomous Web Navigation</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Tell Jarvis "Search Google for latest tech news" or ask a question to search.
                  </p>
                </div>
              </div>
            )}

            {/* 9. MAPS / GALLERY FALLBACK */}
            {['maps', 'gallery'].includes(deviceState.currentApp) && (
              <div className="flex flex-col h-full bg-[#050C1F] p-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[#1E5BFF]/30">
                  <button onClick={() => virtualDevice.press('home')} className="text-slate-300">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-base font-bold text-white capitalize">{deviceState.currentApp}</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  {deviceState.currentApp === 'maps' ? (
                    <MapPin className="w-12 h-12 text-teal-400 mb-2" />
                  ) : (
                    <Image className="w-12 h-12 text-amber-400 mb-2" />
                  )}
                  <h4 className="text-sm font-bold text-white capitalize">{deviceState.currentApp} Ready</h4>
                  <p className="text-xs text-slate-400 mt-1">Screen parsed and accessible by OpenJarvis.</p>
                </div>
              </div>
            )}
          </div>

          {/* Android Navigation Bar */}
          <div className="h-11 bg-black/95 px-12 flex items-center justify-between border-t border-white/5 z-30 select-none">
            <button
              onClick={() => virtualDevice.press('back')}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => virtualDevice.press('home')}
              className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 hover:border-white transition-colors"
              title="Home"
            />
            <button
              onClick={() => virtualDevice.press('recents')}
              className="w-3.5 h-3.5 border-2 border-slate-400 hover:border-white rounded-sm transition-colors"
              title="Recents"
            />
          </div>
        </div>
      </div>

      {/* Quick Test / Autonomous Prompts bar under phone */}
      <div className="w-full mt-3 flex items-center justify-between gap-2 px-1">
        <button
          onClick={() => onRequestJarvisHelp?.('Read my phone screen and tell me what is open')}
          className="flex-1 py-1.5 px-2 bg-[#0A1A3A] border border-[#22D3FF]/40 hover:border-[#22D3FF] text-[11px] text-[#22D3FF] rounded-xl font-medium truncate"
        >
          🔍 "Read screen"
        </button>
        <button
          onClick={() => onRequestJarvisHelp?.('Open YouTube and search for Lo-Fi beats')}
          className="flex-1 py-1.5 px-2 bg-[#0A1A3A] border border-[#1E5BFF]/40 hover:border-[#22D3FF] text-[11px] text-slate-300 rounded-xl font-medium truncate"
        >
          ▶ "Open YouTube"
        </button>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="py-1.5 px-2.5 bg-black/60 border border-white/10 hover:border-white/30 text-[11px] text-slate-400 rounded-xl flex items-center gap-1"
        >
          <Terminal className="w-3 h-3" />
          <span>Logs ({deviceState.logs.length})</span>
        </button>
      </div>

      {/* Accessibility Logs Drawer */}
      {showLogs && (
        <div className="w-full mt-3 p-3 bg-[#03091A] border border-[#1E5BFF]/30 rounded-2xl text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto space-y-1.5 shadow-2xl">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 font-bold text-xs text-[#22D3FF]">
            <span>Accessibility Event Stream</span>
            <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          {deviceState.logs.length === 0 ? (
            <div className="text-slate-500 py-2">No accessibility events yet. Ask Jarvis a command!</div>
          ) : (
            deviceState.logs.map((log) => (
              <div key={log.id} className="leading-tight">
                <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                <span className="text-[#22D3FF] font-semibold">{log.type}</span>: {log.result}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

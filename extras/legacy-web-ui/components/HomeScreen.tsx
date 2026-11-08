import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Mic,
  MicOff,
  Camera,
  Keyboard,
  Send,
  Paperclip,
  Volume2,
  VolumeX,
  Sparkles,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { PersonaInfo } from '../types/jarvis';
import { virtualDevice } from '../services/virtualDevice';

interface HomeScreenProps {
  persona: PersonaInfo;
  onOpenMenu: () => void;
  isRunning: boolean;
  onToggleListening: () => void;
  statusText: string;
  lastResponse: string;
  onSendMessage: (text: string, imageData?: string) => void;
  isProcessing: boolean;
  onOpenPhoneView?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  persona,
  onOpenMenu,
  isRunning,
  onToggleListening,
  statusText,
  lastResponse,
  onSendMessage,
  isProcessing,
  onOpenPhoneView,
}) => {
  const [showText, setShowText] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // When persona layer changes, default text visibility matches MainActivity:
    setShowText(true);
  }, [persona.layer]);

  const handleSend = () => {
    if (!message.trim() && !selectedImage) return;
    onSendMessage(message.trim(), selectedImage || undefined);
    setMessage('');
    setSelectedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openCamera = async () => {
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      setCameraStream(stream);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn('Camera access denied or unavailable, using snapshot', e);
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const takeSnapshot = () => {
    if (cameraVideoRef.current && cameraStream) {
      const canvas = document.createElement('canvas');
      canvas.width = cameraVideoRef.current.videoWidth || 640;
      canvas.height = cameraVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(cameraVideoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelectedImage(dataUrl);
        closeCamera();
        return;
      }
    }
    // Fallback: use persona's high-res snapshot
    setSelectedImage(persona.bg);
    closeCamera();
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#020817] flex flex-col justify-between overflow-hidden select-none">
      {/* Background Image of Selected Persona */}
      <div className="absolute inset-0 z-0">
        <img
          src={persona.bg}
          alt={persona.title}
          className={`w-full h-full object-cover object-center filter brightness-95 oj-character-idle ${isProcessing || isRunning ? 'oj-character-speaking' : ''}`}
        />
        {/* Gradients matching Android Brush.verticalGradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020817]/80 via-transparent via-50% to-[#020817]/95" />
        <div className="absolute inset-0 bg-radial-[circle_at_center] from-transparent via-[#020817]/20 to-[#020817]/80" />
      </div>


      {/* Top Header Bar */}
      <div className="relative z-10 px-5 pt-6 pb-2 flex items-center justify-between">
        {/* Menu Round Button */}
        <button
          onClick={onOpenMenu}
          className="w-13 h-13 rounded-full bg-[#0A1A3A]/90 backdrop-blur-md border border-[#1E8BFF]/60 flex items-center justify-center text-white hover:border-[#22D3FF] hover:shadow-[0_0_15px_rgba(34,211,255,0.4)] transition-all active:scale-95 cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>

        {/* Center Title */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {persona.title}
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22D3FF]/20 text-[#22D3FF] font-mono border border-[#22D3FF]/40">
              L{persona.layer}
            </span>
          </div>
          <p className="text-xs md:text-sm font-medium text-[#22D3FF] tracking-wide drop-shadow-sm mt-0.5">
            {persona.tagline}
          </p>

        </div>

        {/* Right Persona Avatar Thumbnail with Cyan Border */}
        <div
          onClick={onOpenMenu}
          className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#22D3FF] shadow-[0_0_12px_rgba(34,211,255,0.5)] cursor-pointer hover:scale-105 transition-transform"
          title={`Layer ${persona.layer}: ${persona.title}`}
        >
          <img
            src={persona.bg}
            alt={persona.title}
            className={`w-full h-full object-cover object-top oj-avatar-idle ${isProcessing || isRunning ? 'oj-character-speaking' : ''}`}
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#020817]" />
        </div>
      </div>

      {/* Center Ambient / Voice Status HUD */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pointer-events-none">
        {/* Arc Reactor ring effect when active */}
        {isRunning && (
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute w-44 h-44 rounded-full border border-[#22D3FF]/20 animate-ping" />
            <div className="absolute w-36 h-36 rounded-full border-2 border-dashed border-[#22D3FF]/40 animate-spin" style={{ animationDuration: '8s' }} />
            <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#1E5BFF]/30 to-[#22D3FF]/20 backdrop-blur-sm border border-[#22D3FF]/60 flex items-center justify-center shadow-[0_0_35px_rgba(34,211,255,0.4)]">
              <Sparkles className="w-10 h-10 text-[#22D3FF] animate-pulse" />
            </div>
          </div>
        )}

        {/* Selected Image Preview if attached */}
        {selectedImage && (
          <div className="pointer-events-auto relative mb-3 rounded-2xl overflow-hidden border-2 border-[#22D3FF] shadow-xl max-w-xs">
            <img
              src={selectedImage}
              alt="Selected for analysis"
              className="max-h-36 w-auto object-cover"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-1.5 right-1.5 p-1 bg-black/80 rounded-full text-white hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Control Bar Area */}
      <div className="relative z-10 w-full max-w-xl mx-auto px-6 pb-8 flex flex-col items-center">
        {/* Status / Last Response Box */}
        <div className="w-full max-w-md mb-4 px-4 py-2.5 bg-[#0A1A3A]/85 backdrop-blur-md rounded-2xl border border-[#1E5BFF]/40 shadow-xl text-center">
          <p className="text-xs md:text-sm text-slate-100 font-medium line-clamp-3 leading-relaxed">
            {isProcessing ? (
              <span className="text-[#22D3FF] animate-pulse flex items-center justify-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>OpenJarvis is thinking…</span>
              </span>
            ) : lastResponse && isRunning ? (
              <span>"{lastResponse}"</span>
            ) : (
              <span className="text-slate-300">{statusText}</span>
            )}
          </p>
        </div>

        {/* Buttons Row: Camera, Mic (92dp), Chat */}
        <div className="w-full flex items-center justify-around max-w-sm mb-3">
          {/* Camera Button */}
          <button
            onClick={openCamera}
            className="w-15 h-15 rounded-full bg-[#0A1A3A]/90 backdrop-blur-md border-[1.5px] border-[#1E8BFF] hover:border-[#22D3FF] flex flex-col items-center justify-center text-white hover:shadow-[0_0_15px_rgba(30,139,255,0.4)] active:scale-95 transition-all cursor-pointer"
            title="Camera Vision"
          >
            <Camera className="w-6 h-6 text-white" />
            {persona.id === 'ADAM' && (
              <span className="text-[10px] text-slate-200 mt-0.5 font-semibold">Camera</span>
            )}
          </button>

          {/* Central Mic Button (92dp) with animated pulsating cyan ring */}
          <button
            onClick={onToggleListening}
            className={`relative w-23 h-23 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isRunning
                ? 'bg-[#061030] border-4 border-[#22D3FF] shadow-[0_0_35px_#22D3FF] scale-105'
                : 'bg-[#061030]/90 border-4 border-[#1E5BFF] hover:border-[#22D3FF] hover:shadow-[0_0_20px_rgba(34,211,255,0.3)]'
            }`}
            title={isRunning ? 'Tap to stop listening' : 'Tap to start live voice session'}
          >
            {/* Pulsing ripple ring */}
            {isRunning && (
              <span className="absolute inset-0 rounded-full border-2 border-[#22D3FF] animate-ping opacity-60 pointer-events-none" />
            )}
            {isRunning ? (
              <Mic className="w-10 h-10 text-white animate-pulse" />
            ) : (
              <MicOff className="w-10 h-10 text-slate-300" />
            )}
          </button>

          {/* Keyboard / Chat Toggle Button */}
          <button
            onClick={() => setShowText(!showText)}
            className={`w-15 h-15 rounded-full backdrop-blur-md border-[1.5px] flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
              showText
                ? 'bg-[#1E5BFF]/30 border-[#22D3FF] text-[#22D3FF] shadow-[0_0_15px_rgba(34,211,255,0.3)]'
                : 'bg-[#0A1A3A]/90 border-[#1E8BFF] text-white hover:border-[#22D3FF]'
            }`}
            title="Toggle Text Input"
          >
            <Keyboard className="w-6 h-6" />
            {persona.id === 'ADAM' && (
              <span className="text-[10px] mt-0.5 font-semibold">Chat</span>
            )}
          </button>
        </div>

        {/* Layer 3 Voice Hint */}
        {persona.layer === 3 && (
          <p className="text-xs text-[#22D3FF] font-medium tracking-wide mb-2 animate-pulse">
            {isRunning ? 'Listening… tap to stop' : 'Tap to speak'}
          </p>
        )}

        {/* Collapsible Chat Input Field matching OutlinedTextField */}
        {showText && (
          <div className="w-full mt-2 flex items-center gap-2 bg-[#0A1A3A]/95 backdrop-blur-md border border-[#1E5BFF] focus-within:border-[#22D3FF] rounded-full px-3 py-1.5 shadow-2xl transition-all">
            {/* Attachment icon in Layer 2 */}
            {persona.id === 'ADAM' && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-[#22D3FF] hover:text-white rounded-full hover:bg-white/10 transition-colors"
                  title="Attach Photo"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}

            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or command for OpenJarvis…"
              className="flex-1 bg-transparent border-none text-white text-xs md:text-sm placeholder-[#22D3FF]/60 focus:outline-none px-2"
            />

            <button
              onClick={handleSend}
              disabled={isProcessing || (!message.trim() && !selectedImage)}
              className="p-2.5 rounded-full bg-[#22D3FF] text-[#020817] hover:bg-cyan-300 disabled:opacity-40 disabled:hover:bg-[#22D3FF] transition-all cursor-pointer shadow-md"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Camera Capture Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#07122B] border border-[#22D3FF]/40 rounded-3xl p-5 max-w-md w-full shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#22D3FF]" />
                <span>OpenJarvis Visual Lens</span>
              </h3>
              <button
                onClick={closeCamera}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden my-4 relative flex items-center justify-center border border-white/10">
              {cameraStream ? (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-4 text-center">
                  <img
                    src={persona.bg}
                    alt="Snapshot scene"
                    className="w-full h-full object-cover opacity-60 absolute inset-0"
                  />
                  <div className="relative z-10 bg-black/60 p-3 rounded-xl border border-white/10">
                    <p className="text-xs text-white font-medium">
                      Camera viewfinder ready.
                    </p>
                    <p className="text-[11px] text-[#22D3FF] mt-1">
                      Tap "Capture Frame" to send image to {persona.title}.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={closeCamera}
                className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-xs font-semibold hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={takeSnapshot}
                className="flex-1 py-2.5 bg-[#22D3FF] text-[#020817] rounded-xl text-xs font-bold hover:bg-cyan-300 transition-colors shadow-[0_0_15px_rgba(34,211,255,0.4)]"
              >
                Capture Frame
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

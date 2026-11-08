import React from 'react';
import {
  X,
  Home,
  ShieldCheck,
  KeyRound,
  HardDrive,
  Smartphone,
  Sparkles,
  Layers,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { PersonaId, PERSONAS, ScreenId } from '../types/jarvis';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  selectedPersona: PersonaId;
  onSelectPersona: (persona: PersonaId) => void;
  isRunning: boolean;
  onStopListening: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  currentScreen,
  onSelectScreen,
  selectedPersona,
  onSelectPersona,
  isRunning,
  onStopListening,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel matching ModalDrawerSheet */}
      <div className="relative w-80 max-w-[85vw] h-full bg-[#07122B] border-r border-[#1E5BFF]/30 flex flex-col z-10 shadow-2xl overflow-y-auto">
        {/* Top Header */}
        <div className="p-6 border-b border-[#1E5BFF]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/jarvis_logo.webp"
              alt="OpenJarvis Logo"
              className="w-12 h-12 rounded-full border-2 border-[#22D3FF] shadow-[0_0_15px_rgba(34,211,255,0.4)] object-cover"
            />
            <div>
              <h2 className="text-xl font-black tracking-wide text-white flex items-center gap-2">
                OpenJarvis
              </h2>
              <p className="text-xs text-[#22D3FF] font-medium tracking-wider uppercase">
                AI Autonomous OS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* UI Layers Section */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 px-3 py-1 mb-2">
            <Layers className="w-4 h-4 text-[#22D3FF]" />
            <span className="text-xs font-bold text-[#22D3FF] tracking-wider uppercase">
              UI Layers & Personas
            </span>
          </div>

          <div className="space-y-1.5">
            {(Object.keys(PERSONAS) as PersonaId[]).map((pKey) => {
              const p = PERSONAS[pKey];
              const isSelected = selectedPersona === pKey;
              return (
                <button
                  key={pKey}
                  onClick={() => {
                    onSelectPersona(pKey);
                    if (isRunning) onStopListening();
                    onSelectScreen('home');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all text-left ${
                    isSelected
                      ? 'bg-[#0A1A3A] border border-[#22D3FF] shadow-[0_0_12px_rgba(34,211,255,0.25)] text-white'
                      : 'hover:bg-[#0A1A3A]/60 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={p.bg}
                      alt={p.title}
                      className="w-9 h-9 rounded-full object-cover border border-[#22D3FF]/50"
                    />
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        <span>Layer {p.layer} · {p.title}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#22D3FF] animate-pulse" />
                        )}
                      </div>
                      <div className="text-xs text-slate-400">Voice: {p.voice}</div>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#22D3FF]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 my-2 border-t border-[#1E5BFF]/20" />

        {/* Navigation Items */}
        <div className="px-4 py-2 space-y-1.5 flex-1">
          <div className="px-3 py-1 text-xs font-bold text-slate-400 tracking-wider uppercase">
            Menu Navigation
          </div>

          <button
            onClick={() => {
              onSelectScreen('home');
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-sm font-medium ${
              currentScreen === 'home'
                ? 'bg-[#0A1A3A] text-[#22D3FF] border border-[#1E8BFF]/40'
                : 'hover:bg-white/5 text-slate-300'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home Companion</span>
          </button>

          <button
            onClick={() => {
              onSelectScreen('dual_mode');
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-sm font-medium ${
              currentScreen === 'dual_mode'
                ? 'bg-[#0A1A3A] text-[#22D3FF] border border-[#1E8BFF]/40'
                : 'hover:bg-white/5 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-[#22D3FF]" />
              <span>Virtual Phone OS</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E5BFF]/30 text-[#22D3FF] font-semibold border border-[#22D3FF]/30">
              Interactive
            </span>
          </button>

          <button
            onClick={() => {
              onSelectScreen('perm');
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-sm font-medium ${
              currentScreen === 'perm'
                ? 'bg-[#0A1A3A] text-[#22D3FF] border border-[#1E8BFF]/40'
                : 'hover:bg-white/5 text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Permissions & Access</span>
          </button>

          <button
            onClick={() => {
              onSelectScreen('api');
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-sm font-medium ${
              currentScreen === 'api'
                ? 'bg-[#0A1A3A] text-[#22D3FF] border border-[#1E8BFF]/40'
                : 'hover:bg-white/5 text-slate-300'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>API Keys & Providers</span>
          </button>

          <button
            onClick={() => {
              onSelectScreen('memory');
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-sm font-medium ${
              currentScreen === 'memory'
                ? 'bg-[#0A1A3A] text-[#22D3FF] border border-[#1E8BFF]/40'
                : 'hover:bg-white/5 text-slate-300'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Memory (1 GB)</span>
          </button>
        </div>

        {/* Footer info badge */}
        <div className="p-4 m-4 rounded-xl bg-[#020817] border border-[#1E5BFF]/30 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-[#22D3FF] font-semibold mb-1">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Accessibility Core</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Autonomous screen parsing, tapping, scrolling & memory persistence enabled.
          </p>
        </div>
      </div>
    </div>
  );
};

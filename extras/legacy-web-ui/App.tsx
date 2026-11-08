import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PersonaId, PERSONAS, ScreenId, ChatMessage } from './types/jarvis';
import { NavigationDrawer } from './components/NavigationDrawer';
import { HomeScreen } from './components/HomeScreen';
import { VirtualPhone } from './components/VirtualPhone';
import { PermissionsScreen } from './components/PermissionsScreen';
import { ApiScreen } from './components/ApiScreen';
import { MemoryScreen } from './components/MemoryScreen';
import { memoryService } from './services/memory';
import { speechService } from './services/speech';
import { virtualDevice } from './services/virtualDevice';
import { Smartphone, Sparkles, Layers, ArrowLeft } from 'lucide-react';

export default function App() {
  const [personaId, setPersonaId] = useState<PersonaId>(() => {
    try {
      const saved = localStorage.getItem('openjarvis_persona');
      if (saved && saved in PERSONAS) return saved as PersonaId;
    } catch {}
    return 'KAJAL';
  });

  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState('Tap mic to start');
  const [lastResponse, setLastResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('openjarvis_api_key') || '';
  });

  const persona = PERSONAS[personaId];

  // Speech callbacks setup
  useEffect(() => {
    speechService.setCallbacks(
      (transcript: string, isFinal: boolean) => {
        if (isFinal && transcript.trim()) {
          setStatusText(`You: "${transcript.trim()}"`);
          handleSendMessage(transcript.trim());
        } else if (transcript.trim()) {
          setStatusText(`Hearing: "${transcript.trim()}"…`);
        }
      },
      (newStatus: string) => {
        setStatusText(newStatus);
      }
    );
  }, [personaId, customApiKey]);

  const handleSelectPersona = (newId: PersonaId) => {
    setPersonaId(newId);
    try {
      localStorage.setItem('openjarvis_persona', newId);
    } catch {}
    speechService.stopSpeaking();
    if (isRunning) {
      speechService.stopListening();
      setIsRunning(false);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    try {
      localStorage.setItem('openjarvis_api_key', key);
    } catch {}
  };

  const handleToggleListening = () => {
    if (isRunning) {
      speechService.stopListening();
      setIsRunning(false);
      setStatusText('Tap mic to start');
    } else {
      const ok = speechService.startListening();
      if (ok) {
        setIsRunning(true);
        setStatusText('Listening…');
      }
    }
  };

  const handleSendMessage = useCallback(
    async (text: string, imageData?: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setStatusText('OpenJarvis is thinking…');

      // 1. Record user turn in memory
      if (text) {
        memoryService.add('USER', text);
      }

      try {
        const memoryContext = memoryService.tail(4000);

        // First Gemini call
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            persona: personaId,
            memoryContext,
            imageData,
            clientApiKey: customApiKey || undefined,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Server error');
        }

        let replyText = data.text || '';

        // 2. Execute any Function Calls (Accessibility tools)
        if (data.functionCalls && data.functionCalls.length > 0) {
          const functionResponses: any[] = [];

          for (const call of data.functionCalls) {
            const toolResult = virtualDevice.executeTool(call.name, call.args);
            functionResponses.push({
              name: call.name,
              result: toolResult,
            });
          }

          // Follow-up call to Gemini with the function responses
          const followUp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              persona: personaId,
              memoryContext,
              functionResponses,
              clientApiKey: customApiKey || undefined,
            }),
          });

          const followUpData = await followUp.json();
          if (followUpData.success && followUpData.text) {
            replyText = followUpData.text;
          }
        }

        // 3. Process reply
        if (replyText) {
          setLastResponse(replyText);
          memoryService.add('JARVIS', replyText);

          // Audio output via Gemini TTS or browser speech
          await speechService.speak(replyText, personaId, customApiKey || undefined);
        } else {
          setStatusText(isRunning ? 'Listening…' : 'Tap mic to start');
        }
      } catch (err: any) {
        console.error('Chat error:', err);
        const errMsg = `Error: ${err.message || 'Could not reach OpenJarvis'}`;
        setStatusText(errMsg);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, isRunning, personaId, customApiKey]
  );

  return (
    <div className="relative w-full min-h-screen bg-[#020817] text-white flex flex-col font-sans overflow-x-hidden">
      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        selectedPersona={personaId}
        onSelectPersona={handleSelectPersona}
        isRunning={isRunning}
        onStopListening={() => {
          speechService.stopListening();
          setIsRunning(false);
        }}
      />

      {/* Screen Routing */}
      {currentScreen === 'perm' && (
        <PermissionsScreen onBack={() => setCurrentScreen('home')} />
      )}

      {currentScreen === 'api' && (
        <ApiScreen
          onBack={() => setCurrentScreen('home')}
          customApiKey={customApiKey}
          onSaveApiKey={handleSaveApiKey}
        />
      )}

      {currentScreen === 'memory' && (
        <MemoryScreen onBack={() => setCurrentScreen('home')} />
      )}

      {currentScreen === 'dual_mode' && (
        <div className="w-full min-h-screen p-4 md:p-6 flex flex-col">
          {/* Dual Mode Top Bar */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E5BFF]/30 max-w-6xl w-full mx-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentScreen('home')}
                className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span>OpenJarvis Dual View</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#22D3FF]/20 text-[#22D3FF] font-mono">
                    Companion + Virtual Phone
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  See Jarvis automate screen reading, tapping, and typing in real time.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-3.5 py-1.5 bg-[#0A1A3A] border border-[#22D3FF]/50 text-[#22D3FF] rounded-xl text-xs font-semibold hover:bg-[#22D3FF]/10 transition-colors"
            >
              Menu
            </button>
          </div>

          {/* Dual Grid */}
          <div className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: OpenJarvis Companion Screen */}
            <div className="w-full aspect-[9/16] max-h-[820px] rounded-3xl overflow-hidden border-2 border-[#1E5BFF]/40 shadow-2xl relative">
              <HomeScreen
                persona={persona}
                onOpenMenu={() => setIsDrawerOpen(true)}
                isRunning={isRunning}
                onToggleListening={handleToggleListening}
                statusText={statusText}
                lastResponse={lastResponse}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
              />
            </div>

            {/* Right: Simulated Android Device OS */}
            <div className="w-full flex flex-col items-center">
              <VirtualPhone
                onCaptureSnapshot={(img) => handleSendMessage('', img)}
                onRequestJarvisHelp={(prompt) => handleSendMessage(prompt)}
              />
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'home' && (
        <div className="relative w-full h-full min-h-screen">
          <HomeScreen
            persona={persona}
            onOpenMenu={() => setIsDrawerOpen(true)}
            isRunning={isRunning}
            onToggleListening={handleToggleListening}
            statusText={statusText}
            lastResponse={lastResponse}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
            onOpenPhoneView={() => setCurrentScreen('dual_mode')}
          />

          {/* Floating Dual Mode switcher pill on desktop/wide screen */}
          <button
            onClick={() => setCurrentScreen('dual_mode')}
            className="fixed bottom-6 right-6 z-40 px-4 py-2 bg-[#0A1A3A]/90 hover:bg-[#0A1A3A] backdrop-blur-md border border-[#22D3FF]/60 hover:border-[#22D3FF] rounded-full text-xs font-bold text-[#22D3FF] flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,255,0.3)] transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-[#22D3FF]" />
            <span>Virtual Phone View</span>
          </button>
        </div>
      )}
    </div>
  );
}

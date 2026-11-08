export class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onStatusChangeCallback: ((status: string) => void) | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'hi-IN'; // Multi-lingual friendly (Hindi/Hinglish/English)

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStatusChangeCallback?.('Listening…');
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const text = final || interim;
        if (text) {
          this.onTranscriptCallback?.(text, !!final);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.onStatusChangeCallback?.('Microphone permission needed');
          this.isListening = false;
        }
      };

      this.recognition.onend = () => {
        // Automatically restart if user hasn't explicitly stopped listening
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            // Ignore already started
          }
        }
      };
    }
  }

  public setCallbacks(
    onTranscript: (text: string, isFinal: boolean) => void,
    onStatusChange: (status: string) => void
  ) {
    this.onTranscriptCallback = onTranscript;
    this.onStatusChangeCallback = onStatusChange;
  }

  public startListening() {
    if (!this.recognition) {
      this.onStatusChangeCallback?.('Speech recognition not supported in this browser. Please type.');
      return false;
    }
    this.stopSpeaking();
    this.isListening = true;
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      console.warn('Could not start recognition directly:', e);
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
    this.onStatusChangeCallback?.('Tap mic to start');
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  public stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public async speak(
    text: string,
    persona: string = 'KAJAL',
    clientApiKey?: string
  ): Promise<void> {
    this.stopSpeaking();
    if (!text || !text.trim()) return;

    this.onStatusChangeCallback?.('Speaking…');

    // 1. Try Gemini TTS endpoint first
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, persona, clientApiKey }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audioUrl = `data:audio/wav;base64,${data.audioBase64}`;
          const audio = new Audio(audioUrl);
          this.currentAudio = audio;

          await new Promise<void>((resolve) => {
            audio.onended = () => {
              this.currentAudio = null;
              if (this.isListening) {
                this.onStatusChangeCallback?.('Listening…');
              } else {
                this.onStatusChangeCallback?.('Tap mic to start');
              }
              resolve();
            };
            audio.onerror = () => {
              this.currentAudio = null;
              resolve();
            };
            audio.play().catch(() => resolve());
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Gemini TTS failed, using browser speech synthesis', e);
    }

    // 2. Fallback to Browser Speech Synthesis
    if ('speechSynthesis' in window) {
      return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = persona === 'ADAM' ? 0.92 : 1.05;

        // Try to match female voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) =>
            v.lang.startsWith('hi') ||
            (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman'))
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
          if (this.isListening) {
            this.onStatusChangeCallback?.('Listening…');
          } else {
            this.onStatusChangeCallback?.('Tap mic to start');
          }
          resolve();
        };

        utterance.onerror = () => {
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    }
  }
}

export const speechService = new SpeechService();

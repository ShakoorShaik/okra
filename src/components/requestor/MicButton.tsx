'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';

// SpeechRecognition type declarations (not in standard TS lib)
declare class SpeechRecognitionClass extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognitionClass, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionClass, ev: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((this: SpeechRecognitionClass, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionClass, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognitionClass;
    webkitSpeechRecognition: typeof SpeechRecognitionClass;
  }
}

interface Props {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

type MicState = 'idle' | 'listening' | 'processing';

export default function MicButton({ onTranscript, isProcessing }: Props) {
  const [micState, setMicState] = useState<MicState>('idle');
  const [interim, setInterim] = useState('');
  const [fallbackText, setFallbackText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionClass | null>(null);

  useEffect(() => {
    if (!isProcessing) setMicState('idle');
  }, [isProcessing]);

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI() as SpeechRecognitionClass;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-CA';

    recognition.onstart = () => setMicState('listening');

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim('');
        setMicState('processing');
        onTranscript(finalText.trim());
      }
    };

    recognition.onerror = () => {
      setMicState('idle');
      setInterim('');
    };

    recognition.onend = () => {
      if (micState === 'listening') setMicState('idle');
      setInterim('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [micState, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setMicState('idle');
    setInterim('');
  }, []);

  const handleFallbackSubmit = () => {
    if (fallbackText.trim()) {
      onTranscript(fallbackText.trim());
      setFallbackText('');
    }
  };

  const currentState: MicState = isProcessing ? 'processing' : micState;

  if (!isSpeechSupported) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-2">
          <MicOff size={16} />
          <span>Voice not supported — type your request</span>
        </div>
        <div className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFallbackSubmit()}
            placeholder="Describe what care you need..."
            className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base focus:outline-none focus:border-green-500/50"
          />
          <button
            onClick={handleFallbackSubmit}
            disabled={!fallbackText.trim()}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-bold px-4 py-3 rounded-xl transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main mic button */}
      <AnimatePresence mode="wait">
        {currentState === 'idle' && (
          <motion.button
            key="idle"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={startListening}
            className="w-24 h-24 rounded-full border-4 border-green-500 bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center transition-colors focus:outline-none focus:ring-4 focus:ring-green-500/30"
            aria-label="Start voice recording"
          >
            <Mic size={36} className="text-green-500 dark:text-green-400" />
          </motion.button>
        )}

        {currentState === 'listening' && (
          <motion.button
            key="listening"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={stopListening}
            className="w-24 h-24 rounded-full border-4 border-red-500 bg-red-500/10 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-red-500/30"
            aria-label="Stop recording"
          >
            {/* Waveform bars */}
            <div className="flex items-end gap-1 h-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 bg-red-400 rounded-full"
                  animate={{ height: ['8px', '28px', '12px', '24px', '8px'] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          </motion.button>
        )}

        {currentState === 'processing' && (
          <motion.div
            key="processing"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-24 h-24 rounded-full border-4 border-blue-500 bg-blue-500/10 flex items-center justify-center"
          >
            <Loader2 size={36} className="text-blue-500 dark:text-blue-400 animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* State label */}
      <AnimatePresence mode="wait">
        {currentState === 'idle' && (
          <motion.p
            key="idle-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-gray-500 dark:text-gray-400 text-base"
          >
            Tap to speak
          </motion.p>
        )}
        {currentState === 'listening' && (
          <motion.div
            key="listening-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-1"
          >
            <p className="text-red-500 dark:text-red-400 font-semibold text-base">Listening...</p>
            {interim && (
              <p className="text-gray-600 dark:text-gray-300 text-sm max-w-xs text-center italic">&ldquo;{interim}&rdquo;</p>
            )}
          </motion.div>
        )}
        {currentState === 'processing' && (
          <motion.p
            key="processing-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-blue-500 dark:text-blue-400 font-semibold text-base"
          >
            IBM watsonx.ai parsing...
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Leaf, Send, Loader2, Bot, User, RefreshCw } from 'lucide-react';
import { useOkraStore } from '@/lib/store';
import ThemeToggle from '../ThemeToggle';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ActionResult {
  type: string;
  appointment_id?: string;
  time_preference?: string;
}

const SUGGESTIONS = [
  'What does my schedule look like today?',
  'Remove the first appointment from my schedule',
  'What morning visits do I have?',
  'Show me all my confirmed appointments',
];

export default function AgentChat() {
  const router = useRouter();
  const { appointments, updateAppointment, setAppointments } = useOkraStore();

  // Get logged-in provider info
  const providerUser = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('okra_mock_user') ?? 'null'); } catch { return null; } })()
    : null;

  // Same filter as ProviderDashboard: pending (eligible) + own accepted appointments
  const visibleAppointments = providerUser
    ? appointments.filter(a =>
        (a.status === 'pending' && a.services_requested.some((s: string) => providerUser.services_offered.includes(s))) ||
        a.provider_id === providerUser.id
      )
    : appointments;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your scheduling assistant powered by IBM WatsonX. I can help you manage your appointments — add or remove patients, check your schedule, or update visit times. What would you like to do?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Build history excluding the initial greeting
    const history = messages
      .slice(1)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          appointments: visibleAppointments,
          providerId: providerUser?.id ?? null,
          providerName: providerUser?.name ?? null,
        }),
      });

      const data = await res.json() as {
        message: string;
        action: ActionResult | null;
        assistantMessage?: Message;
      };

      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);

      // Reflect action in local store immediately
      if (data.action) {
        const { type, appointment_id, time_preference } = data.action;
        if (type === 'confirm_appointment' && appointment_id) {
          updateAppointment(appointment_id, {
            status: 'caregiver_accepted',
            provider_id: providerUser?.id ?? null,
            provider_name: providerUser?.name ?? null,
          });
        }
        if (type === 'remove_appointment' && appointment_id) {
          updateAppointment(appointment_id, { status: 'pending', provider_id: null, provider_name: null, watsonx_care_plan: null });
        }
        if (type === 'delete_appointment' && appointment_id) {
          setAppointments(appointments.filter((a) => a.id !== appointment_id));
        }
        if (type === 'update_time' && appointment_id && time_preference) {
          updateAppointment(appointment_id, { time_preference: time_preference as never });
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't reach WatsonX. Please try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0a0f0d] text-gray-900 dark:text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/90 dark:bg-[#0a0f0d]/90 backdrop-blur-sm border-b border-gray-200 dark:border-white/5 px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf size={18} className="text-green-400" />
            <span className="font-black text-base">Okra</span>
            <span className="text-gray-400 dark:text-gray-500 text-sm hidden sm:block">/ Scheduling Agent</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'assistant'
                  ? 'bg-green-100 dark:bg-green-500/10'
                  : 'bg-gray-100 dark:bg-white/10'
              }`}>
                {msg.role === 'assistant'
                  ? <Bot size={15} className="text-green-600 dark:text-green-400" />
                  : <User size={15} className="text-gray-600 dark:text-gray-300" />
                }
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-tl-sm'
                  : 'bg-green-500 text-white rounded-tr-sm'
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-green-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">WatsonX is thinking...</span>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-shrink-0 px-4 pb-2"
          >
            <div className="max-w-2xl mx-auto flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-green-400 dark:hover:border-green-500/40 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-white/5 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={() => setMessages([messages[0]])}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Clear chat"
          >
            <RefreshCw size={16} />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask me to manage your schedule..."
            className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-green-400 dark:focus:border-green-500/50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white p-3 rounded-xl transition-colors flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

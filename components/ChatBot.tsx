'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBot() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [localInput, setLocalInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // JANGAN TAMPILKAN CHATBOT SAMA SEKALI KALAU USER BELUM LOGIN
  if (!session) {
    return null;
  }

  const kirimPesan = async () => {
    const trimmed = localInput.trim();
    if (!trimmed || isLoading) return;

    // 1. Masukkan pesan user ke UI
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setLocalInput('');
    setIsLoading(true);
    setErrorMsg(null);

    // 2. Hit API backend
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pastikan kita kirim array of messages yang benar (tanpa atribut id aneh-aneh)
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan dari server');
      }

      // 3. Masukkan balasan AI ke UI
      setMessages(prev => [...prev, {
        id: data.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content
      }]);

    } catch (err: any) {
      console.error("Chat Error:", err);
      setErrorMsg(err.message || 'Gagal menghubungi Eko. Coba lagi ya.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      kirimPesan();
    }
  };

  return (
    <>
      {/* Tombol floating chat */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 p-4 bg-sky-600 text-white rounded-full shadow-lg hover:bg-sky-700 transition-all z-50",
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        )}
      >
        <MessageCircle size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-slate-200"
          >
            {/* Header */}
            <div className="bg-sky-600 text-white p-4 flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-2 rounded-full">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-semibold leading-none">Eko AI</h3>
                  <p className="text-xs text-sky-100 mt-1">Asisten Gudang Spindo</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.length === 0 && !errorMsg && (
                <div className="text-center text-slate-500 mt-10">
                  <Bot size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Halo! Gue Eko. Ada yang bisa dibantu soal data gudang atau fitur aplikasi?</p>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex w-full",
                    m.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm text-sm",
                    m.role === 'user'
                      ? "bg-sky-600 text-white rounded-tr-none"
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                  )}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}

              {/* Error state */}
              {errorMsg && (
                <div className="flex justify-center">
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-xs text-center max-w-[90%] shadow-sm">
                    <p className="font-medium mb-1">⚠️ Gagal terhubung ke AI</p>
                    <p className="text-red-500 mb-2">{errorMsg}</p>
                    <button
                      onClick={() => { setErrorMsg(null); kirimPesan(); }}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    >
                      Coba Lagi
                    </button>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-100 text-sm border-0 rounded-full px-4 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                  value={localInput}
                  placeholder="Ketik pesan..."
                  onChange={(e) => setLocalInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={kirimPesan}
                  disabled={isLoading || !localInput.trim()}
                  className={cn(
                    "p-2.5 rounded-full transition-colors flex items-center justify-center",
                    isLoading || !localInput.trim()
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-sky-600 text-white hover:bg-sky-700 cursor-pointer"
                  )}
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { X, Send, MessageSquare, RotateCcw, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Ringkas pergerakan inbound & outbound hari ini',
  'Gudang mana dengan utilisasi tertinggi?',
  'Apa perbedaan Fast Moving dan Slow Moving?',
];

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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!session) {
    return null;
  }

  const kirimPesan = async (overrideText?: string) => {
    const trimmed = (overrideText ?? localInput).trim();
    if (!trimmed || isLoading) return;

    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    if (!overrideText) setLocalInput('');
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan dari server');
      }

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
      {/* ─── Tactile Neumorphic Floating Trigger ─── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-12 px-4 neu-btn-primary rounded-2xl z-50 flex items-center gap-2 font-bold text-[13px] cursor-pointer",
          isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        )}
        aria-label="Buka Chat dengan Eko AI"
      >
        <MessageSquare size={16} strokeWidth={2.3} />
        <span className="hidden sm:inline">Tanya Eko AI</span>
      </button>

      {/* ─── Sculpted Neumorphic Chat Console ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-6 right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[540px] neu-float flex flex-col overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-[var(--neu-divider)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl neu-icon-inset text-[var(--neu-accent)] flex items-center justify-center">
                  <MessageSquare size={16} strokeWidth={2.3} />
                </span>
                <div>
                  <h3 className="text-[14px] font-extrabold text-[var(--neu-text)] leading-none">
                    Eko AI
                  </h3>
                  <p className="text-[11px] text-[var(--neu-text-muted)] mt-1">
                    Asisten Data Gudang SPINDO
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setMessages([]); setErrorMsg(null); }}
                    className="w-8 h-8 rounded-xl neu-btn text-[var(--neu-text-muted)] flex items-center justify-center cursor-pointer"
                    title="Mulai percakapan baru"
                    aria-label="Mulai percakapan baru"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl neu-btn text-[var(--neu-text-muted)] flex items-center justify-center cursor-pointer"
                  aria-label="Tutup panel AI"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Recessed Chat Well */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--neu-bg)]">
              {messages.length === 0 && !errorMsg && (
                <div className="space-y-4 py-2">
                  <div className="neu-card-sm p-4">
                    <div className="flex items-center gap-2 font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider mb-2">
                      <Database size={12} className="text-[var(--neu-accent)]" />
                      <span>Konteks Gudang Aktif</span>
                    </div>
                    <p className="text-[13px] text-[var(--neu-text-secondary)] leading-relaxed">
                      Halo! Saya <strong className="text-[var(--neu-text)]">Eko AI</strong>. Tanyakan seputar pergerakan tonase SAP, klasifikasi Fast/Slow Moving, kapasitas gudang, atau fitur laporan harian.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider px-1">
                      Contoh Pertanyaan
                    </p>
                    {SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => kirimPesan(q)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl neu-btn text-[12px] font-semibold text-[var(--neu-text-secondary)] cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => (
                <div
                  key={m.id || `msg-${idx}`}
                  className={cn(
                    "flex w-full",
                    m.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 neu-btn-primary text-[13px] font-medium">
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[92%] space-y-2">
                      <div className="neu-card-sm rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] text-[var(--neu-text)] leading-relaxed">
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full neu-inset-sm font-mono text-[10px] text-[var(--neu-text-muted)]">
                        <Database size={10} className="text-[var(--neu-accent)]" />
                        <span>SPINDO Warehouse DB</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Error state */}
              {errorMsg && (
                <div className="neu-inset-sm rounded-xl px-4 py-3 text-xs space-y-2 border border-[var(--neu-red)]/30">
                  <p className="font-bold text-[var(--neu-red)]">Gagal terhubung ke layanan AI</p>
                  <p className="text-[var(--neu-text-secondary)]">{errorMsg}</p>
                  <button
                    type="button"
                    onClick={() => { setErrorMsg(null); kirimPesan(); }}
                    className="neu-btn px-3 py-1.5 rounded-lg text-[11px] font-bold text-[var(--neu-red)] cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl neu-card-sm">
                  <span className="w-1.5 h-1.5 bg-[var(--neu-accent)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-[var(--neu-accent)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-[var(--neu-accent)] rounded-full animate-bounce" />
                  <span className="font-mono text-[10.5px] text-[var(--neu-text-muted)] ml-1">Menganalisa...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Recessed Input Area */}
            <div className="p-3.5 border-t border-[var(--neu-divider)] bg-[var(--neu-surface)]">
              <div className="flex items-center gap-2">
                <input
                  className="neu-input flex-1 h-10 rounded-xl px-3.5 text-[13px]"
                  value={localInput}
                  placeholder="Tanyakan data gudang..."
                  onChange={(e) => setLocalInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => kirimPesan()}
                  disabled={isLoading || !localInput.trim()}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-neu flex items-center justify-center shrink-0",
                    isLoading || !localInput.trim()
                      ? "neu-inset-sm text-[var(--neu-text-muted)] opacity-55 cursor-not-allowed"
                      : "neu-btn-primary cursor-pointer"
                  )}
                  aria-label="Kirim pesan"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
